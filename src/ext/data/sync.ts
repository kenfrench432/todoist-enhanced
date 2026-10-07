import { command, newUuid, type Command } from '@/api/commands';
import type { Note, Snapshot } from '@/domain/types';
import { extCommentContent, extCommentsMatch, findExtSets } from './comment';
import type { ExtData } from './types';

/**
 * Which of two documents is current.
 *
 * The newer `savedAt` wins, and a tie keeps what is already in hand so a sync
 * that brings back the device's own write does not count as a change. Either
 * side may be missing: a device that has never cached one, or an account whose
 * Inbox holds none yet.
 */
export function pickExtDoc(local: ExtData | null, remote: ExtData | null): ExtData | null {
  if (!local) return remote;
  if (!remote) return local;
  return remote.savedAt > local.savedAt ? remote : local;
}

export interface ExtWrite {
  commands: Command[];
  /** The comments the Inbox should hold afterwards, for the optimistic update. */
  contents: string[];
  /** Temp ids for comments being created, in the order of `contents`. */
  tempIds: Array<string | null>;
  /** The comments being removed. */
  removed: Note[];
}

/**
 * The commands that make the Inbox hold exactly this document.
 *
 * The current set's comments are reused where they can be — a one-comment
 * document stays one comment and is updated in place — and anything left over
 * is deleted: the duplicates an older build may have left, and the surplus
 * parts when a document that needed two comments shrinks back to one.
 *
 * Nothing is sent when the comments already say exactly this, so an edit that
 * changes nothing never reaches Todoist.
 */
export function extWrite(snapshot: Snapshot, doc: ExtData): ExtWrite | null {
  const inbox = snapshot.user?.inbox_project_id;
  if (!inbox) return null;

  const [current, ...duplicates] = findExtSets(snapshot);
  const contents = extCommentContent(doc);
  const existing = current?.notes ?? [];

  if (duplicates.length === 0 && extCommentsMatch(existing, contents)) return null;

  const commands: Command[] = [];
  const tempIds: Array<string | null> = [];

  contents.forEach((content, index) => {
    const reuse = existing[index];
    if (reuse) {
      tempIds.push(null);
      if (reuse.content !== content) {
        commands.push(command('note_update', { id: reuse.id, content }));
      }
      return;
    }
    const tempId = newUuid();
    tempIds.push(tempId);
    commands.push({
      type: 'note_add', uuid: newUuid(), temp_id: tempId,
      args: { project_id: inbox, content },
    });
  });

  /* Whatever the current set no longer needs, plus every older set. A document
     that shrank from two comments to one leaves the second behind otherwise. */
  const removed = [...existing.slice(contents.length), ...duplicates.flatMap((set) => set.notes)];
  for (const note of removed) commands.push(command('note_delete', { id: note.id }));

  if (commands.length === 0) return null;
  return { commands, contents, tempIds, removed };
}

/** The Inbox as it will look once the write lands, for the optimistic update. */
export function applyExtWrite(snapshot: Snapshot, write: ExtWrite, inbox: string): Snapshot {
  const notes = { ...snapshot.notes };
  const [current] = findExtSets(snapshot);
  const existing = current?.notes ?? [];

  write.contents.forEach((content, index) => {
    const reuse = existing[index];
    if (reuse) {
      notes[reuse.id] = { ...reuse, content };
      return;
    }
    const tempId = write.tempIds[index];
    if (!tempId) return;
    notes[tempId] = {
      id: tempId,
      item_id: null,
      project_id: inbox,
      content,
      posted_at: new Date().toISOString(),
      posted_uid: snapshot.user?.id ?? '',
      is_deleted: false,
      file_attachment: null,
    } as Note;
  });

  for (const note of write.removed) delete notes[note.id];
  return { ...snapshot, notes };
}
