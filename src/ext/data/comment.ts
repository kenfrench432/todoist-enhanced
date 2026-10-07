import type { Note, Snapshot } from '@/domain/types';
import { migrate } from './migrate';
import type { ExtData } from './types';

/**
 * The extension document, as Todoist comments.
 *
 * The same shape upstream uses for its settings (`src/store/prefs.ts`): a
 * marker line, a blank line, then one line of JSON, posted as a comment on the
 * Inbox. Todoist keeps no edit date on a comment, so the document carries its
 * own `savedAt`, which is what says which of two comments is the current one.
 */
export const EXT_MARKER =
  'Enhanced for Todoist · ext data (edited by the app, please leave as is)';

/**
 * Todoist refuses a comment over 15,000 characters:
 * https://www.todoist.com/help/articles/usage-limits-in-todoist-e5rcSY
 *
 * The payload budget is well under it. The slack covers the header line and
 * the fact that the limit counts characters while a name full of accents costs
 * more than its length suggests — a document that is refused is a document
 * that is lost, so the margin is deliberate.
 */
export const MAX_COMMENT = 15_000;
export const CHUNK_BUDGET = 12_000;

export interface ExtChunk {
  part: number;
  total: number;
  savedAt: number;
  /** This comment's slice of the JSON — not parseable on its own when total > 1. */
  payload: string;
}

/**
 * The header of a chunked comment: the marker, which part this is, and the
 * stamp of the write it belongs to.
 *
 * The stamp has to be on this line rather than only inside the JSON. A chunk
 * holds a fragment that does not parse by itself, so without a stamp in the
 * header there is no way to tell which chunks came from the same write — and
 * joining chunks from two different writes produces confident nonsense.
 */
const header = (part: number, total: number, savedAt: number): string =>
  total === 1 ? EXT_MARKER : `${EXT_MARKER} ${part}/${total} · ${savedAt}`;

/** The comment bodies for a document: one, or several when it is long. */
export function extCommentContent(doc: ExtData): string[] {
  const json = JSON.stringify(doc);
  if (json.length <= CHUNK_BUDGET) return [`${header(1, 1, doc.savedAt)}\n\n${json}`];

  const total = Math.ceil(json.length / CHUNK_BUDGET);
  const parts: string[] = [];
  for (let index = 0; index < total; index += 1) {
    const payload = json.slice(index * CHUNK_BUDGET, (index + 1) * CHUNK_BUDGET);
    parts.push(`${header(index + 1, total, doc.savedAt)}\n\n${payload}`);
  }
  return parts;
}

/** What a comment carries, or null when it is not one of ours. */
export function readExtComment(content: string): ExtChunk | null {
  if (!content.startsWith(EXT_MARKER)) return null;
  const newline = content.indexOf('\n');
  const line = (newline === -1 ? content : content.slice(0, newline)).trim();
  const payload = (newline === -1 ? '' : content.slice(newline)).trim();

  const suffix = line.slice(EXT_MARKER.length).trim();
  /* No part suffix is a single comment written by any build, this one
     included: its stamp is inside the JSON, read below. */
  if (!suffix) {
    let savedAt = 0;
    try {
      const value: unknown = JSON.parse(payload);
      if (value && typeof value === 'object' && typeof (value as ExtData).savedAt === 'number') {
        savedAt = (value as ExtData).savedAt;
      }
    } catch {
      return null; // a single comment whose JSON is broken carries nothing
    }
    return { part: 1, total: 1, savedAt, payload };
  }

  const match = /^(\d+)\/(\d+) · (\d+)$/.exec(suffix);
  if (!match) return null;
  const [, part, total, savedAt] = match;
  return {
    part: Number(part),
    total: Number(total),
    savedAt: Number(savedAt),
    payload,
  };
}

/** Every ext comment on the Inbox, whole or in parts. */
export function extComments(snapshot: Snapshot): Note[] {
  const inbox = snapshot.user?.inbox_project_id;
  if (!inbox) return [];
  return Object.values(snapshot.notes).filter(
    (note) => !note.is_deleted && note.project_id === inbox && !note.item_id
      && note.content.startsWith(EXT_MARKER),
  );
}

export interface ExtSet {
  savedAt: number;
  notes: Note[];
  doc: ExtData;
}

/**
 * The documents the Inbox holds, newest first.
 *
 * Comments are grouped by the write they belong to. A set missing a part is
 * left out rather than half-read: a document joined from an incomplete set is
 * worse than an older one that is whole, and the caller takes the newest set
 * that actually parses.
 */
export function findExtSets(snapshot: Snapshot): ExtSet[] {
  const groups = new Map<number, Array<{ note: Note; chunk: ExtChunk }>>();
  for (const note of extComments(snapshot)) {
    const chunk = readExtComment(note.content);
    if (!chunk) continue;
    const group = groups.get(chunk.savedAt) ?? [];
    group.push({ note, chunk });
    groups.set(chunk.savedAt, group);
  }

  const sets: ExtSet[] = [];
  for (const [savedAt, group] of groups) {
    const total = group[0].chunk.total;
    const byPart = new Map(group.map((entry) => [entry.chunk.part, entry]));
    if (byPart.size !== total) continue; // a part is missing
    const ordered: Array<{ note: Note; chunk: ExtChunk }> = [];
    for (let part = 1; part <= total; part += 1) {
      const entry = byPart.get(part);
      if (!entry || entry.chunk.total !== total) break;
      ordered.push(entry);
    }
    if (ordered.length !== total) continue;

    try {
      const doc = migrate(JSON.parse(ordered.map((entry) => entry.chunk.payload).join('')));
      sets.push({ savedAt, notes: ordered.map((entry) => entry.note), doc });
    } catch {
      continue; // the JSON did not survive; an older set may still be good
    }
  }

  return sets.sort((a, b) => b.savedAt - a.savedAt);
}

/** The account's current document, or null when the Inbox holds none. */
export const readExtDoc = (snapshot: Snapshot): ExtData | null =>
  findExtSets(snapshot)[0]?.doc ?? null;

/** Whether the comments already say exactly what these bodies would write. */
export function extCommentsMatch(notes: Note[], contents: string[]): boolean {
  if (notes.length !== contents.length) return false;
  return notes.every((note, index) => note.content === contents[index]);
}
