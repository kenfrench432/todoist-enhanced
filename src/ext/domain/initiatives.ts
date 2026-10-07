import { differenceInCalendarDays, startOfDay } from 'date-fns';
import { deadlineDate } from '@/domain/dates';
import { hasLabel } from '@/domain/views';
import type { Item } from '@/domain/types';
import type { ExtSettings, Tone } from '@/ext/data/types';
import { swapPrefixedLabel } from './labels';

/**
 * Internal projects: what a Todoist task is saying when it carries the
 * initiative marker, and what is worth warning about.
 */

export const INITIATIVE_STATUSES = ['idea', 'planned', 'active', 'blocked', 'done'] as const;
export type InitiativeStatus = (typeof INITIATIVE_STATUSES)[number];

/** Active first, then what needs a decision, then what is parked or finished. */
export const STATUS_ORDER: InitiativeStatus[] =
  ['active', 'blocked', 'planned', 'idea', 'done'];

export const STATUS_LABELS: Record<InitiativeStatus, string> = {
  idea: 'Idea', planned: 'Planned', active: 'Active', blocked: 'Blocked', done: 'Done',
};

export const STATUS_TONES: Record<InitiativeStatus, Tone> = {
  idea: 'gray', planned: 'blue', active: 'green', blocked: 'red', done: 'gray',
};

/** How long an Active initiative can go quiet before it is worth saying so. */
export const QUIET_DAYS = 14;

export interface Initiative {
  /** The focus area's slug, from the `focus-` label. Null when it has none. */
  focus: string | null;
  status: InitiativeStatus;
  /** The target date: the task's deadline. */
  target: Date | null;
  /** The first line of the description, shown when the status is blocked. */
  blockedReason: string | null;
}

const prefixed = (item: Item, prefix: string): string | null => {
  const lower = prefix.toLowerCase();
  const found = item.labels.find((label) => label.toLowerCase().startsWith(lower));
  return found ? found.slice(prefix.length) : null;
};

/** What a task carrying the initiative marker is saying. */
export function readInitiative(item: Item, settings: ExtSettings): Initiative {
  const raw = prefixed(item, settings.labels.statusPrefix)?.toLowerCase();
  const known = INITIATIVE_STATUSES.find((status) => status === raw);
  /* A completed task is done whatever its label says: ticking it off in
     Todoist is the same statement as setting the status here. */
  const status: InitiativeStatus = item.checked ? 'done' : known ?? 'idea';

  const firstLine = item.description.split('\n')[0]?.trim() ?? '';
  return {
    focus: prefixed(item, settings.labels.focusPrefix),
    status,
    target: deadlineDate(item),
    blockedReason: firstLine || null,
  };
}

/** Active and Planned are live: they are meant to be moving. */
export const isLive = (status: InitiativeStatus): boolean =>
  status === 'active' || status === 'planned';

export type WarningTone = 'red' | 'amber';
export interface Warning { text: string; tone: WarningTone }

/**
 * What is wrong with an initiative, in the order it is worth hearing.
 *
 * "No next action" and "Quiet for N days" are deliberately exclusive: an
 * initiative with nothing open at all is already being told the louder thing,
 * and saying both would bury it.
 */
export function initiativeWarnings(
  initiative: Initiative,
  children: Item[],
  now: Date,
  lastDone: Date | null = null,
): Warning[] {
  const warnings: Warning[] = [];

  if (initiative.status === 'blocked') {
    warnings.push({ text: initiative.blockedReason ?? 'Blocked', tone: 'red' });
  }

  const open = children.filter((child) => !child.checked);
  if (isLive(initiative.status) && open.length === 0) {
    warnings.push({ text: 'No next action', tone: 'red' });
  } else if (initiative.status === 'active' && lastDone !== null) {
    const days = differenceInCalendarDays(startOfDay(now), startOfDay(lastDone));
    if (days > QUIET_DAYS) warnings.push({ text: `Quiet for ${days} days`, tone: 'amber' });
  }

  return warnings;
}

/** Done over total for an initiative's sub-tasks. */
export function initiativeProgress(children: Item[]): { done: number; total: number } {
  return {
    done: children.filter((child) => child.checked).length,
    total: children.length,
  };
}

/**
 * The labels a new initiative gets, or an existing one after a change.
 *
 * Built by swapping rather than rebuilding, so labels the task carries for
 * other reasons — a customer, upstream's `week` — survive the edit.
 */
export function labelsForInitiative(
  labels: string[],
  settings: ExtSettings,
  change: { focus?: string | null; status?: InitiativeStatus },
): string[] {
  let next = labels.some((label) => label.toLowerCase() === settings.labels.initiative.toLowerCase())
    ? [...labels]
    : [...labels, settings.labels.initiative];
  if (change.focus !== undefined) {
    next = swapPrefixedLabel(next, settings.labels.focusPrefix, change.focus);
  }
  if (change.status !== undefined) {
    next = swapPrefixedLabel(next, settings.labels.statusPrefix, change.status);
  }
  return next;
}

/**
 * The focus area a `focus-` label slug belongs to.
 *
 * `readInitiative` gives back what the label says — the slug after the prefix
 * — while everything else works in focus-area ids. This is the one place that
 * knows they are different things.
 */
export function focusAreaIdOf(
  slug: string | null,
  areas: Array<{ id: string; label: string }>,
  prefix: string,
): string | null {
  if (slug === null) return null;
  const wanted = `${prefix}${slug}`.toLowerCase();
  const found = areas.find((area) => area.label.toLowerCase() === wanted)
    /* An area registered by id rather than by label still resolves, so a
       document written before the labels were set up is not orphaned. */
    ?? areas.find((area) => area.id.toLowerCase() === slug.toLowerCase());
  return found?.id ?? null;
}

/** The `focus-` label slug for a focus-area id, for writing one back. */
export function focusSlugOf(
  id: string,
  areas: Array<{ id: string; label: string }>,
  prefix: string,
): string | null {
  const area = areas.find((entry) => entry.id === id);
  if (!area) return null;
  return area.label.toLowerCase().startsWith(prefix.toLowerCase())
    ? area.label.slice(prefix.length)
    : area.label;
}

/** The open initiatives in a snapshot: tasks carrying the marker. */
export const initiativesIn = (items: Item[], settings: ExtSettings): Item[] =>
  items.filter((item) => !item.parent_id && hasLabel(item, settings.labels.initiative));
