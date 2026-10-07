import { describe, expect, it } from 'vitest';
import { emptySnapshot, type Note, type Snapshot } from '../../domain/types';
import { extCommentContent, findExtSets, readExtDoc } from './comment';
import { defaultExtData } from './defaults';
import { applyExtWrite, extWrite, pickExtDoc } from './sync';
import type { ExtData } from './types';

const INBOX = 'inbox-1';

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

/** Runs a write against a snapshot and returns the Inbox as it ends up. */
function afterWrite(snapshot: Snapshot, doc: ExtData): Snapshot {
  const write = extWrite(snapshot, doc);
  if (!write) return snapshot;
  return applyExtWrite(snapshot, write, INBOX);
}

function bigDoc(savedAt: number): ExtData {
  const data = defaultExtData(savedAt);
  for (let index = 0; index < 400; index += 1) {
    data.notes[`w:2026-W${index}`] = 'x'.repeat(80);
  }
  return data;
}

describe('pickExtDoc', () => {
  it('takes the newer stamp', () => {
    expect(pickExtDoc(defaultExtData(1), defaultExtData(2))?.savedAt).toBe(2);
    expect(pickExtDoc(defaultExtData(3), defaultExtData(2))?.savedAt).toBe(3);
  });

  /* A sync that hands back this device's own write is not a change. */
  it('keeps what is in hand on a tie', () => {
    const local = defaultExtData(5);
    expect(pickExtDoc(local, defaultExtData(5))).toBe(local);
  });

  it('copes with either side missing', () => {
    expect(pickExtDoc(null, defaultExtData(1))?.savedAt).toBe(1);
    expect(pickExtDoc(defaultExtData(1), null)?.savedAt).toBe(1);
    expect(pickExtDoc(null, null)).toBeNull();
  });
});

describe('extWrite', () => {
  it('creates the comment the first time', () => {
    const write = extWrite(snapshotWith([]), defaultExtData(1));
    expect(write?.commands.map((c) => c.type)).toEqual(['note_add']);
    expect(readExtDoc(afterWrite(snapshotWith([]), defaultExtData(1)))?.savedAt).toBe(1);
  });

  it('updates in place rather than adding a second', () => {
    const snapshot = snapshotWith(extCommentContent(defaultExtData(1)));
    const write = extWrite(snapshot, defaultExtData(2));
    expect(write?.commands.map((c) => c.type)).toEqual(['note_update']);
    expect(findExtSets(afterWrite(snapshot, defaultExtData(2)))).toHaveLength(1);
  });

  /* An edit that changes nothing must never reach Todoist. */
  it('sends nothing when the comment already says this', () => {
    const doc = defaultExtData(1);
    expect(extWrite(snapshotWith(extCommentContent(doc)), doc)).toBeNull();
  });

  it('deletes the duplicates an older build left behind', () => {
    const snapshot = snapshotWith([
      ...extCommentContent(defaultExtData(100)),
      ...extCommentContent(defaultExtData(200)),
    ]);
    const write = extWrite(snapshot, defaultExtData(300));
    expect(write?.commands.filter((c) => c.type === 'note_delete')).toHaveLength(1);
    expect(findExtSets(afterWrite(snapshot, defaultExtData(300)))).toHaveLength(1);
  });

  it('grows to a second comment and shrinks back, leaving no surplus', () => {
    const start = snapshotWith(extCommentContent(defaultExtData(1)));

    const grown = afterWrite(start, bigDoc(2));
    expect(findExtSets(grown)[0].notes.length).toBeGreaterThan(1);

    /* The second comment has to go, or the next read finds a part of an old
       write sitting beside a whole new one. */
    const shrunk = afterWrite(grown, defaultExtData(3));
    const sets = findExtSets(shrunk);
    expect(sets).toHaveLength(1);
    expect(sets[0].notes).toHaveLength(1);
    expect(readExtDoc(shrunk)?.savedAt).toBe(3);
  });

  it('round-trips a long document through the Inbox', () => {
    const doc = bigDoc(7);
    expect(readExtDoc(afterWrite(snapshotWith([]), doc))).toEqual(doc);
  });

  it('writes nothing before the account has an Inbox', () => {
    const snapshot = emptySnapshot();
    expect(extWrite(snapshot, defaultExtData(1))).toBeNull();
  });
});
