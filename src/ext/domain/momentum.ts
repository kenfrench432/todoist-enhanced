import { differenceInCalendarDays, startOfDay, startOfISOWeek, subWeeks } from 'date-fns';

/**
 * Whether a focus area is actually moving.
 *
 * A goal can look fine on its KPI and still have had nothing done about it for
 * a month. This counts completed actions per week and says, in one word,
 * which way the work is going.
 */

export type Momentum = 'Rising' | 'Steady' | 'Slowing' | 'Stalling';

/** How long without an action before a focus area counts as stalled. */
export const STALL_DAYS = 14;
export const WEEKS = 8;

/**
 * Completed actions per ISO week, oldest first, the current week last.
 *
 * Anything completed before the window, or after now, is left out — the array
 * is always `weeks` long, so the bar chart has a bar per week whether or not
 * anything happened in it.
 */
export function weeklyCounts(completedAt: Date[], now: Date, weeks = WEEKS): number[] {
  const counts = new Array<number>(weeks).fill(0);
  const thisWeek = startOfISOWeek(startOfDay(now));

  for (const date of completedAt) {
    const week = startOfISOWeek(startOfDay(date));
    const back = Math.round(differenceInCalendarDays(thisWeek, week) / 7);
    if (back < 0 || back >= weeks) continue;
    counts[weeks - 1 - back] += 1;
  }
  return counts;
}

/** Days since the last completed action, or null when there has never been one. */
export function daysSinceLast(completedAt: Date[], now: Date): number | null {
  if (completedAt.length === 0) return null;
  const latest = completedAt.reduce((a, b) => (a > b ? a : b));
  return Math.max(differenceInCalendarDays(startOfDay(now), startOfDay(latest)), 0);
}

const sum = (values: number[]): number => values.reduce((total, value) => total + value, 0);

/**
 * Which way a focus area is going, from the last 8 weeks.
 *
 * The recent half is weighed against the earlier half. Stalling is checked
 * first and wins outright: a focus area with nothing done in a fortnight is
 * stalled whatever the ratio of two quiet halves happens to say — and 0 vs 0
 * would otherwise read as Rising, since zero is not less than zero.
 */
export function momentum(weekly: number[], since: number | null): Momentum {
  const half = Math.floor(weekly.length / 2);
  const recent = sum(weekly.slice(half));
  const previous = sum(weekly.slice(0, half));

  if (since === null || since > STALL_DAYS || recent === 0) return 'Stalling';
  if (recent >= previous * 1.2) return 'Rising';
  if (recent <= previous * 0.7) return 'Slowing';
  return 'Steady';
}

export const MOMENTUM_TONES: Record<Momentum, 'green' | 'blue' | 'amber' | 'red'> = {
  Rising: 'green',
  Steady: 'blue',
  Slowing: 'amber',
  Stalling: 'red',
};

/** This week's count, and whether it clears the floor. */
export function thisWeek(weekly: number[], floor: number): { count: number; belowFloor: boolean } {
  const count = weekly[weekly.length - 1] ?? 0;
  return { count, belowFloor: count < floor };
}

/** The window the completed API has to be asked for, to fill these counts. */
export const momentumSince = (now: Date, weeks = WEEKS): Date =>
  startOfISOWeek(subWeeks(startOfDay(now), weeks - 1));

/**
 * When the work on a focus area was actually done.
 *
 * Attribution is by **label**, which is why this works where Phase 6's "quiet
 * for N days" could not: a `CompletedItem` carries no `parent_id`, so a
 * completed sub-task cannot be traced to its initiative — but it does carry
 * `labels`, and the focus label is one of them.
 *
 * That holds because a task added to an initiative through the app inherits
 * its parent's labels. A task typed straight into Todoist without the focus
 * label will not count towards its area, which is a limit of the mapping
 * rather than a fault in the counting.
 */
export function focusCompletions(
  completed: Array<{ completed_at: string; labels?: string[] }>,
  focusLabel: string,
): Date[] {
  const wanted = focusLabel.toLowerCase();
  const dates: Date[] = [];
  for (const row of completed) {
    if (!(row.labels ?? []).some((label) => label.toLowerCase() === wanted)) continue;
    const at = new Date(row.completed_at);
    if (!Number.isNaN(at.getTime())) dates.push(at);
  }
  return dates;
}
