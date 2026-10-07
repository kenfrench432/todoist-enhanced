import { addMonths, addWeeks, endOfYear, startOfDay } from 'date-fns';
import { toApiDate } from '@/domain/dates';
import { hasLabel } from '@/domain/views';
import type { Item, Snapshot } from '@/domain/types';
import type { Customer, ExtSettings, FocusArea, Goal } from '@/ext/data/types';
import { isMarkerLabel } from './labels';

/**
 * The rules the Manage page needs, kept out of the components so they can be
 * tested: the node test environment has no DOM, and a rule that only exists
 * inside a component is a rule nobody can check.
 */

/**
 * Todoist labels that are neither the fork's own nor a registered customer.
 *
 * Almost always a customer nobody has registered yet, which is why Manage
 * offers a one-click Register rather than just listing them. Upstream's own
 * planning labels are markers as far as this is concerned — they belong to
 * the app, not to a customer.
 */
export function unlinkedLabels(
  snapshot: Snapshot,
  customers: Customer[],
  settings: ExtSettings,
  reserved: string[] = ['week', 'quick', 'waiting'],
): string[] {
  const taken = new Set([
    ...customers.map((customer) => customer.label.toLowerCase()),
    ...reserved.map((name) => name.toLowerCase()),
  ]);
  return Object.values(snapshot.labels)
    .filter((label) => !label.is_deleted)
    .map((label) => label.name)
    /* est-* is upstream's estimate storage, not something anybody registers. */
    .filter((name) => !name.toLowerCase().startsWith('est-'))
    .filter((name) => !taken.has(name.toLowerCase()))
    .filter((name) => !isMarkerLabel(name, settings))
    .sort((a, b) => a.localeCompare(b));
}

/**
 * Whether this name is already taken.
 *
 * Trimmed and case-insensitive, because "Alex" and "alex " are the same
 * person. `selfId` is the row being renamed, which must not count as a clash
 * with itself — otherwise correcting a typo in a name is impossible.
 */
export function duplicateName<T extends { id: string; name: string }>(
  existing: T[], name: string, selfId?: string,
): boolean {
  const wanted = name.trim().toLowerCase();
  if (!wanted) return false;
  return existing.some((row) =>
    row.id !== selfId && row.name.trim().toLowerCase() === wanted);
}

/** Open tasks per customer id, for the table's count column. */
export function customerCounts(items: Item[], customers: Customer[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const customer of customers) {
    counts[customer.id] = customer.label
      ? items.filter((item) => !item.checked && hasLabel(item, customer.label)).length
      : 0;
  }
  return counts;
}

export interface GoalGroup {
  focus: FocusArea | null;
  goals: Goal[];
}

/**
 * Goals under their focus area, every area shown even when it has none.
 *
 * A goal whose focus area has been deleted still has to appear somewhere, or
 * it would vanish from the page while staying in the document. Those come last,
 * under a group with no area.
 */
export function goalGroups(goals: Goal[], focusAreas: FocusArea[]): GoalGroup[] {
  const groups: GoalGroup[] = focusAreas.map((focus) => ({
    focus,
    goals: goals.filter((goal) => goal.focus === focus.id),
  }));
  const known = new Set(focusAreas.map((focus) => focus.id));
  const orphans = goals.filter((goal) => !known.has(goal.focus));
  if (orphans.length > 0) groups.push({ focus: null, goals: orphans });
  return groups;
}

export const TARGET_CHOICES = ['keep', '2w', '1m', 'eoy', 'none'] as const;
export type TargetChoice = (typeof TARGET_CHOICES)[number];

export const TARGET_LABELS: Record<TargetChoice, string> = {
  keep: 'Keep', '2w': 'In 2 weeks', '1m': 'In a month', eoy: 'End of year', none: 'No date',
};

/**
 * The deadline a target choice resolves to.
 *
 * Null removes the deadline; undefined means leave it exactly as it is, which
 * is a different thing and is what "Keep" means.
 */
export function targetDeadline(choice: TargetChoice, now: Date): string | null | undefined {
  const today = startOfDay(now);
  switch (choice) {
    case 'keep': return undefined;
    case 'none': return null;
    case '2w': return toApiDate(addWeeks(today, 2));
    case '1m': return toApiDate(addMonths(today, 1));
    default: return toApiDate(endOfYear(today));
  }
}

/** How many initiatives point at each goal, for the "n initiatives linked" line. */
export function goalLinkCounts(
  initiativeGoals: Record<string, string>, liveTaskIds: ReadonlySet<string>,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const [taskId, goal] of Object.entries(initiativeGoals)) {
    if (!liveTaskIds.has(taskId)) continue;
    counts[goal] = (counts[goal] ?? 0) + 1;
  }
  return counts;
}
