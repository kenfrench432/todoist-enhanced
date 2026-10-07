import { addDays, differenceInCalendarDays, endOfISOWeek, startOfDay } from 'date-fns';
import { deadlineDate, dueDate } from '@/domain/dates';
import { hasLabel } from '@/domain/views';
import type { Item } from '@/domain/types';
import type { Customer, ExtSettings } from '@/ext/data/types';

/**
 * What the Customers page shows, and what it leaves out.
 *
 * Three periods — Today, This week, All — and the question of whether an
 * engagement is worth putting in front of someone right now. Every rule takes
 * "now"; none reads the clock.
 */

export const PERIODS = ['today', 'week', 'all'] as const;
export type CustomerPeriod = (typeof PERIODS)[number];

/** The upstream label that means "no date, but I mean to do it this week". */
export const WEEK_LABEL = 'week';

/**
 * Whether a task falls in the period being shown.
 *
 * Today includes anything overdue: a task that was due last Tuesday is more
 * today's problem than Tuesday's. This week takes anything due by Sunday —
 * overdue included, for the same reason — plus undated tasks carrying
 * upstream's `week` label, which is how that label already reads everywhere
 * else in the app.
 *
 * The week runs Monday to Sunday (DATA-MODEL §3). `weekStartsOn` is here so
 * that following the user's Todoist start_day instead is one argument rather
 * than a rewrite.
 */
export function inPeriod(
  item: Item,
  period: CustomerPeriod,
  now: Date,
  weekLabel: string = WEEK_LABEL,
  weekStartsOn: 0 | 1 = 1,
): boolean {
  if (period === 'all') return true;

  const due = dueDate(item);
  const today = startOfDay(now);
  if (period === 'today') return due !== null && startOfDay(due) <= today;

  if (due === null) return hasLabel(item, weekLabel);
  const end = weekStartsOn === 1
    ? startOfDay(endOfISOWeek(today))
    : startOfDay(addDays(today, 6 - today.getDay()));
  return startOfDay(due) <= end;
}

/** The engagements of one customer: parent tasks carrying the engagement marker. */
export const engagementsOf = (
  items: Item[], customer: Customer, settings: ExtSettings,
): Item[] => items.filter((item) =>
  !item.checked && !item.parent_id
    && hasLabel(item, customer.label)
    && hasLabel(item, settings.labels.engagement));

/**
 * A customer's loose tasks in the period.
 *
 * Loose means not belonging to an engagement: an engagement's sub-tasks are
 * shown inside its own card, and showing them here as well would count every
 * one of them twice.
 */
export function customerTasks(
  items: Item[],
  customer: Customer,
  period: CustomerPeriod,
  now: Date,
  settings: ExtSettings,
  weekLabel: string = WEEK_LABEL,
): Item[] {
  const engagementIds = new Set(engagementsOf(items, customer, settings).map((e) => e.id));
  return items.filter((item) =>
    !item.checked
    && hasLabel(item, customer.label)
    && !hasLabel(item, settings.labels.engagement)
    && !(item.parent_id && engagementIds.has(item.parent_id))
    && inPeriod(item, period, now, weekLabel));
}

/** How many days until an engagement's date — its deadline, or its due date. */
export function daysUntil(engagement: Item, now: Date): number | null {
  const date = deadlineDate(engagement) ?? dueDate(engagement);
  return date === null ? null : differenceInCalendarDays(startOfDay(date), startOfDay(now));
}

/**
 * Whether an engagement is worth showing in this period.
 *
 * On Today, an engagement earns its place by being close — within `soonDays`,
 * or already past. On This week it also earns it by having a task in the week,
 * because an engagement being worked on this week belongs on the week's page
 * whatever its own date says. An engagement with no date at all shows only
 * under All, where nothing is being filtered.
 */
export function engagementVisible(
  engagement: Item,
  period: CustomerPeriod,
  showEngagements: boolean,
  now: Date,
  soonDays: number,
  children: Item[] = [],
  weekLabel: string = WEEK_LABEL,
): boolean {
  if (!showEngagements) return false;
  if (period === 'all') return true;

  const days = daysUntil(engagement, now);
  const soon = days !== null && days <= soonDays;
  if (period === 'today') return soon;

  return soon || children.some((child) =>
    !child.checked && inPeriod(child, 'week', now, weekLabel));
}

/** A customer with nothing to show: no tasks in the period and no engagement. */
export const customerEmpty = (tasks: Item[], visibleEngagements: Item[]): boolean =>
  tasks.length === 0 && visibleEngagements.length === 0;

/** Done over total for an engagement's sub-tasks, for its progress bar. */
export function engagementProgress(
  children: Item[], doneIds: ReadonlySet<string> = new Set(),
): { done: number; total: number } {
  const total = children.length;
  const done = children.filter((child) => child.checked || doneIds.has(child.id)).length;
  return { done, total };
}
