import { describe, expect, it } from 'vitest';
import { emptySnapshot, type Note, type Snapshot } from '../../domain/types';
import {
  CHUNK_BUDGET, EXT_MARKER, MAX_COMMENT,
  extCommentContent, extCommentsMatch, findExtSets, readExtComment, readExtDoc,
} from './comment';
import { defaultExtData } from './defaults';
import type { ExtData } from './types';

const INBOX = 'inbox-1';

const note = (id: string, content: string): Note => ({
  id,
  item_id: null,
  project_id: INBOX,
  content,
  posted_at: '2026-09-29T09:00:00Z',
  posted_uid: 'u1',
  is_deleted: false,
  file_attachment: null,
} as Note);

function snapshotWith(contents: string[]): Snapshot {
  const snapshot = emptySnapshot();
  snapshot.user = { inbox_project_id: INBOX } as Snapshot['user'];
  contents.forEach((content, index) => {
    snapshot.notes[`n${index}`] = note(`n${index}`, content);
  });
  return snapshot;
}

/** A document big enough to need splitting, from one long field. */
function bigDoc(savedAt: number): ExtData {
  const data = defaultExtData(savedAt);
  data.notes = {};
  for (let index = 0; index < 400; index += 1) {
    data.notes[`w:2026-W${index}`] = 'x'.repeat(80);
  }
  return data;
}

describe('one comment', () => {
  it('round-trips a document', () => {
    const doc = defaultExtData(1700);
    const [content] = extCommentContent(doc);
    expect(content.startsWith(EXT_MARKER)).toBe(true);
    expect(readExtDoc(snapshotWith([content]))).toEqual(doc);
  });

  /* A single comment has no part suffix, so its stamp lives in the JSON —
     which is how a document written by any build still reads. */
  it('takes its stamp from the JSON when there is no part suffix', () => {
    const [content] = extCommentContent(defaultExtData(4242));
    expect(content.split('\n')[0]).toBe(EXT_MARKER);
    expect(readExtComment(content)).toMatchObject({ part: 1, total: 1, savedAt: 4242 });
  });

  it('ignores a comment that is not ours', () => {
    expect(readExtComment('Shopping list')).toBeNull();
    expect(readExtDoc(snapshotWith(['Shopping list']))).toBeNull();
  });

  it('carries nothing when the JSON is broken', () => {
    expect(readExtComment(`${EXT_MARKER}\n\n{not json`)).toBeNull();
  });
});

describe('a document too long for one comment', () => {
  it('splits, and comes back identical', () => {
    const doc = bigDoc(99);
    const contents = extCommentContent(doc);
    expect(contents.length).toBeGreaterThan(1);
    expect(readExtDoc(snapshotWith(contents))).toEqual(doc);
  });

  it('keeps every comment inside what Todoist accepts', () => {
    for (const content of extCommentContent(bigDoc(99))) {
      expect(content.length).toBeLessThan(MAX_COMMENT);
      expect(content.length).toBeLessThanOrEqual(CHUNK_BUDGET + EXT_MARKER.length + 40);
    }
  });

  it('stamps every part with the same write, so they can be grouped', () => {
    const chunks = extCommentContent(bigDoc(777)).map(readExtComment);
    expect(chunks.every((chunk) => chunk?.savedAt === 777)).toBe(true);
    expect(chunks.map((chunk) => chunk?.part)).toEqual(chunks.map((_, i) => i + 1));
  });

  /* Half a document joined together is worse than a whole older one: it would
     parse into confident nonsense, or fail and lose the older one too. */
  it('is left out when a part is missing, so an older whole one wins', () => {
    const old = defaultExtData(100);
    const partial = extCommentContent(bigDoc(200));
    const sets = findExtSets(snapshotWith([...extCommentContent(old), partial[0]]));
    expect(sets).toHaveLength(1);
    expect(sets[0].savedAt).toBe(100);
  });
});

describe('more than one document on the Inbox', () => {
  it('reads the newest, and names the older ones for deleting', () => {
    const older = extCommentContent(defaultExtData(100));
    const newer = extCommentContent(defaultExtData(900));
    const sets = findExtSets(snapshotWith([...older, ...newer]));
    expect(sets.map((set) => set.savedAt)).toEqual([900, 100]);
    expect(readExtDoc(snapshotWith([...older, ...newer]))?.savedAt).toBe(900);
  });

  it('ignores a comment somebody deleted, and comments on a task', () => {
    const snapshot = snapshotWith(extCommentContent(defaultExtData(5)));
    snapshot.notes.n0 = { ...snapshot.notes.n0, is_deleted: true };
    expect(readExtDoc(snapshot)).toBeNull();

    const onTask = snapshotWith(extCommentContent(defaultExtData(5)));
    onTask.notes.n0 = { ...onTask.notes.n0, item_id: 'task-1' };
    expect(readExtDoc(onTask)).toBeNull();
  });

  it('finds nothing before the account has an Inbox', () => {
    const snapshot = snapshotWith(extCommentContent(defaultExtData(5)));
    snapshot.user = null;
    expect(readExtDoc(snapshot)).toBeNull();
  });
});

describe('extCommentsMatch', () => {
  it('is true only when the comments already say exactly this', () => {
    const contents = extCommentContent(defaultExtData(1));
    const notes = contents.map((content, index) => note(`n${index}`, content));
    expect(extCommentsMatch(notes, contents)).toBe(true);
    expect(extCommentsMatch(notes, extCommentContent(defaultExtData(2)))).toBe(false);
    expect(extCommentsMatch([], contents)).toBe(false);
  });
});
