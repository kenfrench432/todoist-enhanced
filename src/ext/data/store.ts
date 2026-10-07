import { create } from 'zustand';
import * as idb from '@/db/idb';
import { useStore } from '@/store/store';
import { remapTaskIds } from './actions';
import { readExtDoc } from './comment';
import { defaultExtData } from './defaults';
import { migrate } from './migrate';
import { applyExtWrite, extWrite, pickExtDoc } from './sync';
import type { ExtData } from './types';

export const EXT_DATA_KEY = 'ext-data';
const WRITE_DELAY_MS = 500;

interface ExtState {
  data: ExtData;
  /** False until the cached document has been read off the device. */
  loaded: boolean;
  /** Applies a change and writes it, debounced. */
  update: (fn: (data: ExtData) => ExtData) => void;
  /** Reads the cached document. Called once, on import. */
  hydrate: () => Promise<void>;
}

let writeTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * The extension data, and the one place it is written from.
 *
 * A store of its own rather than a slice of the app's: it is the fork's, and a
 * slice would mean editing `src/store/store.ts` at every merge. Everything it
 * needs from upstream is already public — `useStore.subscribe`,
 * `useStore.getState().apply`, and the generic `idb.loadPrefs` / `savePrefs`.
 */
export const useExt = create<ExtState>()((set, get) => ({
  data: defaultExtData(),
  loaded: false,

  async hydrate() {
    if (get().loaded) return;
    const cached = await idb.loadPrefs<unknown>(EXT_DATA_KEY);
    const local = cached ? migrate(cached) : null;
    /* A sync may have landed while this was reading. Whatever the account
       holds is weighed against the cache the same way as always. */
    const remote = readExtDoc(useStore.getState().snapshot);
    set({ data: pickExtDoc(local, remote) ?? defaultExtData(), loaded: true });
  },

  update(fn) {
    const demo = useStore.getState().demo;
    const data = { ...fn(get().data), savedAt: Date.now() };
    set({ data });

    /* A demo is a sandbox. `apply` already stops its commands reaching
       Todoist, but the cache is this fork's own to guard: without this, trying
       the demo would overwrite the real account's document on the device. */
    if (demo) return;

    void idb.savePrefs(EXT_DATA_KEY, data);
    scheduleWrite();
  },
}));

/** Writes the document to its Inbox comment, no more than once per 500 ms. */
function scheduleWrite(): void {
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    writeTimer = null;
    void flushExtWrite();
  }, WRITE_DELAY_MS);
}

export async function flushExtWrite(): Promise<void> {
  const app = useStore.getState();
  if (app.demo) return;
  const inbox = app.snapshot.user?.inbox_project_id;
  if (!inbox) return; // nothing to write to yet; the next edit tries again

  const write = extWrite(app.snapshot, useExt.getState().data);
  if (!write) return; // the comment already says this

  await app.apply(write.commands, (snapshot) => applyExtWrite(snapshot, write, inbox));
}

/**
 * Keeps the links pointing at tasks that still exist.
 *
 * A task created here has a temporary id until Todoist answers. Anything
 * linked to it in the meantime has to follow it to its real id, or the link
 * names something that has stopped existing.
 */
useStore.subscribe((state, previous) => {
  if (state.resolvedIds === previous.resolvedIds || state.demo) return;
  const fresh: Record<string, string> = {};
  for (const [temp, real] of Object.entries(state.resolvedIds)) {
    if (previous.resolvedIds[temp] !== real) fresh[temp] = real;
  }
  if (Object.keys(fresh).length === 0) return;
  const current = useExt.getState().data;
  const next = remapTaskIds(current, fresh);
  if (next !== current) useExt.getState().update(() => next);
});

/**
 * Takes the account's document when a sync brings a newer one.
 *
 * This is what makes two tabs converge: each writes its own comment, and the
 * next sync hands both of them whichever write was later.
 */
useStore.subscribe((state, previous) => {
  if (state.snapshot === previous.snapshot || state.demo) return;
  const remote = readExtDoc(state.snapshot);
  if (!remote) return;
  const current = useExt.getState().data;
  if (remote.savedAt <= current.savedAt) return;
  useExt.setState({ data: remote, loaded: true });
  void idb.savePrefs(EXT_DATA_KEY, remote);
});

void useExt.getState().hydrate();
