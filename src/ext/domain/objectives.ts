import { toApiDate } from '@/domain/dates';
import { hasLabel } from '@/domain/views';
import type { Item } from '@/domain/types';
import type { ExtSettings } from '@/ext/data/types';
import { swapPrefixedLabel } from './labels';
import {
  containsDay, parentPeriod, periodBounds, type Cadence,
} from './periods';

/**
 * Objectives: a few outcomes per day, week, month and quarter, each supporting
 * the level above it.
 */

const CADENCE_OF: Record<string, Cadence> = {
  day: 'd', week: 'w', month: 'm', quarter: 'q',
};
const PERIOD_NAME: Record<Cadence, string> = {
  d: 'day', w: 'week', m: 'month', q: 'quarter',
};

export interface Objective {
  cadence: Cadence | null;
  focus: string | null;
}

const prefixed = (item: Item, prefix: string): string | null => {
  const lower = prefix.toLowerCase();
  const found = item.labels.find((label) => label.toLowerCase().startsWith(lower));
  return found ? found.slice(prefix.length) : null;
};

/** What a task carrying the objective marker is saying. */
export function readObjective(item: Item, settings: ExtSettings): Objective {
  const period = prefixed(item, settings.labels.periodPrefix)?.toLowerCase() ?? '';
  return {
    cadence: CADENCE_OF[period] ?? null,
    focus: prefixed(item, settings.labels.focusPrefix),
  };
}

/** The open and completed objectives of one cadence. */
export const objectivesIn = (
  items: Item[], settings: ExtSettings, cadence: Cadence,
): Item[] => items.filter((item) =>
  hasLabel(item, settings.labels.objective)
  && readObjective(item, settings).cadence === cadence);

/**
 * The due date an objective of this period gets: the **last day** of it.
 *
 * A weekly objective is due on Sunday, not spread across the week — which is
 * what lets a plain Todoist view still show it on the day it has to be true by.
 */
export const dueForPeriod = (cadence: Cadence, offset: number, now: Date): string =>
  toApiDate(periodBounds(cadence, offset, now).end);

/** The labels a new objective gets. */
export function labelsForObjective(
  labels: string[],
  settings: ExtSettings,
  change: { cadence?: Cadence; focus?: string | null },
): string[] {
  let next = labels.some((l) => l.toLowerCase() === settings.labels.objective.toLowerCase())
    ? [...labels]
    : [...labels, settings.labels.objective];
  if (change.cadence !== undefined) {
    next = swapPrefixedLabel(next, settings.labels.periodPrefix, PERIOD_NAME[change.cadence]);
  }
  if (change.focus !== undefined) {
    next = swapPrefixedLabel(next, settings.labels.focusPrefix, change.focus);
  }
  return next;
}

export interface Move {
  /** The new due date, as the API wants it. */
  due: string;
  /**
   * True when the parent link has to go, because the parent's period no
   * longer holds the new period's start.
   */
  dropParent: boolean;
}

/**
 * Moving an objective to the next period.
 *
 * The part worth getting right is the parent. A weekly objective moved from
 * week 40 to week 41 was supporting September — and week 41 starts on 5
 * October, so September cannot hold it any more and the link goes. Keeping it
 * would leave a week claiming to support a month it is not in.
 *
 * `parentDue` is the parent objective's due date, which is the last day of the
 * parent's own period and so says which period that is.
 */
export function moveToNext(
  cadence: Cadence,
  offset: number,
  now: Date,
  parentDue: Date | null = null,
): Move {
  const next = offset + 1;
  const due = dueForPeriod(cadence, next, now);
  if (parentDue === null) return { due, dropParent: false };

  const parent = parentPeriod(cadence, next, now);
  /* No level above a quarter, so a quarterly objective's parent — if it
     somehow has one — is not this rule's business. */
  if (!parent) return { due, dropParent: false };

  return { due, dropParent: !containsDay(parent, parentDue) };
}

export interface Capacity {
  open: number;
  done: number;
  total: number;
  cap: number;
  over: boolean;
  /** One entry per slot shown, including the ones over the cap. */
  slots: Array<'done' | 'open' | 'free' | 'over'>;
}

/**
 * How full a period is against its cap.
 *
 * The cap is a nudge, not a rule: going over is allowed and simply shown as
 * such, because the page's job is to say "this is more than you meant to take
 * on", not to refuse the work.
 */
export function capacity(objectives: Item[], cap: number): Capacity {
  const done = objectives.filter((item) => item.checked).length;
  const total = objectives.length;
  const open = total - done;

  const slots: Capacity['slots'] = [];
  for (let index = 0; index < Math.max(cap, total); index += 1) {
    if (index < done) slots.push('done');
    else if (index < total) slots.push(index < cap ? 'open' : 'over');
    else slots.push('free');
  }
  return { open, done, total, cap, over: total > cap, slots };
}

/** The cap for a cadence, from settings. */
export const capFor = (cadence: Cadence, settings: ExtSettings): number =>
  settings.objectiveCaps[cadence];
