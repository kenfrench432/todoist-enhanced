import { dueDate, toApiDate } from '@/domain/dates';
import { hasLabel } from '@/domain/views';
import type { CompletedItem, Item } from '@/domain/types';
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

/* ---------- What the Objectives page needs ---------- */

/**
 * The objectives of one cadence whose period this is — open and done alike.
 *
 * Placed by **due date**, which is what decides an objective's period: it is
 * due on the period's last day. The items passed in should come from the
 * snapshot rather than `openItems`, so a completed objective is still counted
 * towards its period's "2 of 3 done" instead of vanishing from it.
 */
export function objectivesInPeriod(
  items: Item[],
  settings: ExtSettings,
  cadence: Cadence,
  period: { start: Date; end: Date },
): Item[] {
  return items.filter((item) => {
    if (item.is_deleted) return false;
    if (!hasLabel(item, settings.labels.objective)) return false;
    if (readObjective(item, settings).cadence !== cadence) return false;
    const due = dueDate(item);
    return due !== null && containsDay(period, due);
  });
}

/**
 * Objectives the snapshot has forgotten, recovered from the completed API.
 *
 * An approximation, and only ever a fallback. A `CompletedItem` carries no due
 * date, so the only thing to place it by is when it was finished — and an
 * objective finished a week late belongs to the period it was *due* in, not
 * the one it was closed in. The snapshot knows the due date and is used first;
 * this fills in older periods it no longer holds, where a rough answer beats
 * an empty one.
 */
export function mergeCompleted(
  fromSnapshot: Item[],
  completed: CompletedItem[],
  settings: ExtSettings,
  cadence: Cadence,
  period: { start: Date; end: Date },
): CompletedItem[] {
  const known = new Set(fromSnapshot.map((item) => item.id));
  const marker = settings.labels.objective.toLowerCase();
  const periodLabel = `${settings.labels.periodPrefix}${PERIOD_NAME[cadence]}`.toLowerCase();

  return completed.filter((row) => {
    const id = row.task_id ?? row.id;
    if (known.has(id)) return false;
    const labels = (row.labels ?? []).map((label) => label.toLowerCase());
    if (!labels.includes(marker) || !labels.includes(periodLabel)) return false;
    const at = new Date(row.completed_at);
    return !Number.isNaN(at.getTime()) && containsDay(period, at);
  });
}

/** "done of total" for a cadence's current period, for the tab. */
export function cadenceCounts(
  objectives: Item[], extra = 0,
): { done: number; total: number } {
  const done = objectives.filter((item) => item.checked).length;
  return { done: done + extra, total: objectives.length + extra };
}

/** The question each cadence opens and closes with (SPEC §5). */
export const PROMPTS: Record<Cadence, { start: string; end: string }> = {
  d: {
    start: 'Pick the few outcomes that make today a good day.',
    end: 'What got done, what moves to tomorrow, and why?',
  },
  w: {
    start: 'Choose the outcomes for the week, each supporting a monthly objective.',
    end: 'What did I finish, what carries over, and what should I stop doing?',
  },
  m: {
    start: 'Turn the quarter into three outcomes for the month.',
    end: 'Check the KPIs, score each objective, and note what changes next month.',
  },
  q: {
    start: 'Set the quarter against your goals and KPIs.',
    end: 'Score each objective, look at KPI movement, and write what you will do differently.',
  },
};

/** What "move to the next period" is called, per cadence. */
export const NEXT_NAME: Record<Cadence, string> = {
  d: 'tomorrow', w: 'next week', m: 'next month', q: 'next quarter',
};
