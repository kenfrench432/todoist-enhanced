import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/db/idb', () => ({
  loadPrefs: vi.fn(async () => null),
  savePrefs: vi.fn(async () => {}),
  saveSnapshot: vi.fn(async () => {}),
  enqueue: vi.fn(async () => {}),
  dequeue: vi.fn(async () => {}),
  updateQueued: vi.fn(async () => {}),
  readQueue: vi.fn(async () => []),
}));
vi.mock('@/api/commands', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/commands')>()),
  sendCommands: vi.fn(),
}));

import * as idb from '@/db/idb';
import { sendCommands, type Command, type CommandResult } from '@/api/commands';
import { emptySnapshot, type Note, type Snapshot } from '@/domain/types';
import { defaultPreferences } from '@/store/prefs';
import { useStore } from '@/store/store';
import { addCustomer, setNote } from './actions';
import { extCommentContent, readExtDoc } from './comment';
import { defaultExtData } from './defaults';
import { EXT_DATA_KEY, flushExtWrite, useExt } from './store';

const INBOX = 'inbox-1';
const sent = vi.mocked(sendCommands);
const saved = vi.mocked(idb.savePrefs);

const ok = (commands: Command[]): CommandResult => ({
  responses: [], failures: [], mapping: {},
  delivered: commands.map((cmd) => cmd.uuid), undelivered: [],
});

function snapshotWith(contents: string[]): Snapshot {
  const snapshot = emptySnapshot();
  snapshot.user = { id: 'u1', inbox_project_id: INBOX } as Snapshot['user'];
  contents.forEach((content, index) => {
    snapshot.notes[`n${index}`] = {
      id: `n${index}`, item_id: null, project_id: INBOX, content,
      posted_at: '2026-09-29T09:00:00Z', posted_uid: 'u1',
      is_deleted: false, file_attachment: null,
    } as Note;
  });
  return snapshot;
}

beforeEach(() => {
  vi.stubGlobal('navigator', { onLine: true });
  vi.clearAllMocks();
  sent.mockImplementation(async (_token, commands) => ok(commands));
  useStore.setState({
    prefs: defaultPreferences('en'), connected: true, demo: false,
    snapshot: snapshotWith([]), toasts: [], undoStack: [], pendingCount: 0, syncState: 'idle',
  });
  useExt.setState({ data: defaultExtData(0), loaded: true });
});
afterEach(() => vi.unstubAllGlobals());

describe('update', () => {
  it('stamps the change so a later write wins', () => {
    const before = Date.now();
    useExt.getState().update((data) => addCustomer(data, 'Aston Martin'));
    expect(useExt.getState().data.customers[0].name).toBe('Aston Martin');
    expect(useExt.getState().data.savedAt).toBeGreaterThanOrEqual(before);
  });

  it('caches the document on the device', () => {
    useExt.getState().update((data) => setNote(data, 'w:2026-W40', 'Draft'));
    expect(saved).toHaveBeenCalledWith(EXT_DATA_KEY, useExt.getState().data);
  });
});

describe('demo mode', () => {
  /* A demo is a sandbox. Nothing about it may reach Todoist, and — the part
     apply cannot guard — nothing may overwrite the real account's cache. */
  it('writes neither the comment nor the cache', async () => {
    useStore.setState({ demo: true });
    useExt.getState().update((data) => addCustomer(data, 'Demo Co'));

    expect(saved).not.toHaveBeenCalled();
    await flushExtWrite();
    expect(sent).not.toHaveBeenCalled();
    // The change still shows on screen: a sandbox, not a read-only mode.
    expect(useExt.getState().data.customers[0].name).toBe('Demo Co');
  });
});

describe('flushExtWrite', () => {
  it('puts the document in the Inbox comment', async () => {
    useExt.getState().update((data) => addCustomer(data, 'Aston Martin'));
    await flushExtWrite();

    expect(sent).toHaveBeenCalledTimes(1);
    const commands = sent.mock.calls[0][1];
    expect(commands.map((c) => c.type)).toEqual(['note_add']);
    expect(readExtDoc(useStore.getState().snapshot)?.customers[0].name).toBe('Aston Martin');
  });

  it('sends nothing when the comment already says this', async () => {
    const doc = defaultExtData(5);
    useExt.setState({ data: doc, loaded: true });
    useStore.setState({ snapshot: snapshotWith(extCommentContent(doc)) });

    await flushExtWrite();
    expect(sent).not.toHaveBeenCalled();
  });

  it('waits rather than writing before the account has an Inbox', async () => {
    useStore.setState({ snapshot: emptySnapshot() });
    useExt.getState().update((data) => addCustomer(data, 'A'));
    await flushExtWrite();
    expect(sent).not.toHaveBeenCalled();
  });
});

describe('the debounce', () => {
  /* Typing a customer's name is a dozen edits. They are one write. */
  it('collapses a burst of edits into a single write', async () => {
    vi.useFakeTimers();
    try {
      const ext = useExt.getState();
      for (const name of ['A', 'As', 'Ast', 'Asto', 'Aston']) {
        ext.update((data) => ({ ...data, customers: [], notes: { name } }));
      }
      expect(sent).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(600);
      expect(sent).toHaveBeenCalledTimes(1);
      expect(readExtDoc(useStore.getState().snapshot)?.notes).toEqual({ name: 'Aston' });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('a sync bringing another tab’s write', () => {
  it('takes the newer document and caches it', () => {
    useExt.setState({ data: defaultExtData(100), loaded: true });
    const theirs = addCustomer(defaultExtData(900), 'From the other tab');

    useStore.setState({ snapshot: snapshotWith(extCommentContent(theirs)) });

    expect(useExt.getState().data.savedAt).toBe(900);
    expect(useExt.getState().data.customers[0].name).toBe('From the other tab');
    expect(saved).toHaveBeenCalledWith(EXT_DATA_KEY, useExt.getState().data);
  });

  /* The sync that hands back this device's own write, or an older one from a
     tab that has not caught up, must not undo what is on screen. */
  it('keeps the newer local document when the account holds an older one', () => {
    const mine = addCustomer(defaultExtData(900), 'Mine');
    useExt.setState({ data: mine, loaded: true });

    useStore.setState({ snapshot: snapshotWith(extCommentContent(defaultExtData(100))) });

    expect(useExt.getState().data).toBe(mine);
  });

  it('ignores the account entirely in demo mode', () => {
    useStore.setState({ demo: true });
    const mine = defaultExtData(1);
    useExt.setState({ data: mine, loaded: true });

    useStore.setState({ snapshot: snapshotWith(extCommentContent(defaultExtData(900))) });
    expect(useExt.getState().data).toBe(mine);
  });
});
