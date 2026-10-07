import { differenceInCalendarDays, endOfWeek, startOfDay } from 'date-fns';
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

/** 0 = Sunday, as date-fns counts them. */
export type WeekStart = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Todoist's `start_day` (1 = Monday … 7 = Sunday) as date-fns counts days.
 *
 * The same conversion upstream's `weekBounds` makes, so the two cannot drift.
 */
export const weekStartOf = (startDay: number | undefined): WeekStart =>
  ((startDay ?? 1) % 7) as WeekStart;

/**
 * Whether a task falls in the period being shown.
 *
 * Today includes anything overdue: a task that was due last Tuesday is more
 * today's problem than Tuesday's. This week takes anything due by Sunday —
 * overdue included, for the same reason — plus undated tasks carrying
 * upstream's `week` label, which is how that label already reads everywhere
 * else in the app.
 *
 * The week starts on the day the account's Todoist `start_day` says, passed in
 * as `weekStartsOn` (0 = Sunday, the same numbering date-fns uses). Upstream's
 * My week follows that setting, and two pages in one app disagreeing about
 * which week is meant is worse than either answer on its own.
 */
export function inPeriod(
  item: Item,
  period: CustomerPeriod,
  now: Date,
  weekLabel: string = WEEK_LABEL,
  weekStartsOn: WeekStart = 1,
): boolean {
  if (period === 'all') return true;

  const due = dueDate(item);
  const today = startOfDay(now);
  if (period === 'today') return due !== null && startOfDay(due) <= today;

  if (due === null) return hasLabel(item, weekLabel);
  return startOfDay(due) <= startOfDay(endOfWeek(today, { weekStartsOn }));
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

/* ---------- Which customers the page shows, and in what order ---------- */

export interface CustomerFilters {
  csms: string[];
  stages: string[];
  tiers: string[];
}

export const NO_FILTERS: CustomerFilters = { csms: [], stages: [], tiers: [] };

/** How many groups are narrowing the list, for the "Filters · n" button. */
export const activeFilterCount = (filters: CustomerFilters): number =>
  [filters.csms, filters.stages, filters.tiers].filter((group) => group.length > 0).length;

/**
 * Whether a customer survives the filters.
 *
 * Within a group the choices are alternatives — picking two CSMs means either
 * of them. Across groups they narrow — a CSM *and* a tier. An empty group is
 * not a filter at all, so "no CSM chosen" shows every CSM rather than none.
 */
export function matchesFilters(customer: Customer, filters: CustomerFilters): boolean {
  const inGroup = (chosen: string[], value: string | null) =>
    chosen.length === 0 || (value !== null && chosen.includes(value));
  return inGroup(filters.csms, customer.csm)
    && inGroup(filters.stages, customer.stage)
    && inGroup(filters.tiers, customer.tier);
}

export type CustomerSort = 'az' | 'custom';

/**
 * The customers to draw, filtered and in order.
 *
 * A customer missing from `customerOrder` — added on another device, or from
 * before the order existed — still appears, after the ones that are in it. A
 * sort that can lose a customer is worse than one in the wrong order.
 */
export function shownCustomers(
  customers: Customer[],
  order: string[],
  options: { excluded?: string[]; filters?: CustomerFilters; sort?: CustomerSort },
): Customer[] {
  const excluded = new Set(options.excluded ?? []);
  const filters = options.filters ?? NO_FILTERS;
  const kept = customers.filter((customer) =>
    !excluded.has(customer.id) && matchesFilters(customer, filters));

  if (options.sort !== 'custom') {
    return [...kept].sort((a, b) => a.name.localeCompare(b.name));
  }

  const rank = new Map(order.map((id, index) => [id, index]));
  return [...kept].sort((a, b) => {
    const left = rank.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const right = rank.get(b.id) ?? Number.MAX_SAFE_INTEGER;
    return left - right || a.name.localeCompare(b.name);
  });
}

export interface CustomerCardData {
  customer: Customer;
  tasks: Item[];
  engagements: Item[];
}

/**
 * The counts the header prints.
 *
 * Taken from the cards the page is about to draw, not computed a second way,
 * so the subtitle cannot claim a number the page does not show.
 */
export function summarise(cards: CustomerCardData[]): {
  tasks: number; engagements: number; customers: number;
} {
  return {
    tasks: cards.reduce((total, card) => total + card.tasks.length, 0),
    engagements: cards.reduce((total, card) => total + card.engagements.length, 0),
    customers: cards.length,
  };
}

/** The labels a new task or engagement will carry, shown before it is created. */
export const composerLabels = (
  kind: 'task' | 'engagement', customer: Customer, settings: ExtSettings,
): string[] =>
  (kind === 'engagement' ? [customer.label, settings.labels.engagement] : [customer.label])
    .filter(Boolean);

/** The initials on a customer's colour mark: one word gives one letter, two give two. */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}
