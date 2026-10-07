import { addYears, differenceInCalendarDays, startOfDay } from 'date-fns';
import type { Kpi } from '@/ext/data/types';

/**
 * Where a KPI stands against the year.
 *
 * The question these answer is not "how far along is this number" but "how far
 * along should it be by now" — a KPI at 40% of its target in January is doing
 * well, and the same KPI in November is not.
 */

export type PaceState = 'reached' | 'onTrack' | 'atRisk' | 'behind';

export interface Pace {
  /** The latest reading, or the starting value when nothing has been logged. */
  value: number;
  /** How much of the distance from start to target has been covered, 0–1 and beyond. */
  progress: number;
  /** How much of the year has gone, 0–1. */
  elapsed: number;
  state: PaceState;
}

/** The start of the goal year that `now` falls in. */
export function goalYearStart(now: Date, yearStartMonth: number): Date {
  const month = Math.min(Math.max(Math.round(yearStartMonth), 1), 12) - 1;
  const start = startOfDay(new Date(now.getFullYear(), month, 1));
  return start <= startOfDay(now) ? start : new Date(now.getFullYear() - 1, month, 1);
}

/**
 * The share of the goal year gone, 0–1.
 *
 * Counted in whole days rather than milliseconds, so the number does not creep
 * through the day and a test on a given date has one answer.
 */
export function elapsedShare(now: Date, yearStartMonth = 1): number {
  const start = goalYearStart(now, yearStartMonth);
  const end = addYears(start, 1);
  const total = differenceInCalendarDays(end, start);
  const gone = differenceInCalendarDays(startOfDay(now), start);
  return Math.min(Math.max(gone / total, 0), 1);
}

/** How many days of the goal year are left. */
export const daysLeftInYear = (now: Date, yearStartMonth = 1): number =>
  differenceInCalendarDays(addYears(goalYearStart(now, yearStartMonth), 1), startOfDay(now));

/** The most recent reading, or the starting value when there is none. */
export const kpiValue = (kpi: Kpi): number =>
  kpi.history.length > 0 ? kpi.history[kpi.history.length - 1].value : kpi.start;

/**
 * A KPI's progress and what to call it.
 *
 * `(value − start) / (target − start)` carries "lower is better" for free: a
 * KPI going from 40 down to 10 has both differences negative, and the ratio
 * still rises as the number improves. No special case, no flag to set.
 *
 * `target === start` is the one that would divide by zero. There is no
 * distance to cover, so the only question is whether the value has got there —
 * which, with no direction to infer, means reaching the target exactly.
 */
export function kpiPace(kpi: Kpi, now: Date, yearStartMonth = 1): Pace {
  const value = kpiValue(kpi);
  const elapsed = elapsedShare(now, yearStartMonth);

  if (kpi.target === kpi.start) {
    const reached = value === kpi.target;
    return { value, progress: reached ? 1 : 0, elapsed, state: reached ? 'reached' : 'behind' };
  }

  const raw = (value - kpi.start) / (kpi.target - kpi.start);
  /* A KPI sitting exactly on its start, counting downwards, divides 0 by a
     negative and gives -0. It formats as "0" but compares as its own thing,
     so it is flattened here rather than surprising a caller. NaN is left
     alone: that would be a bug worth seeing. */
  const progress = raw === 0 ? 0 : raw;
  return { value, progress, elapsed, state: paceState(progress, elapsed) };
}

/**
 * Reached, on track, at risk or behind.
 *
 * The 0.05 grace stops a KPI measured once a month reading "at risk" for the
 * three weeks between readings, and the 0.7 is the line between "behind the
 * pace" and "not going to make it".
 */
export function paceState(progress: number, elapsed: number): PaceState {
  if (progress >= 1) return 'reached';
  if (progress >= elapsed - 0.05) return 'onTrack';
  if (progress >= elapsed * 0.7) return 'atRisk';
  return 'behind';
}

export const PACE_LABELS: Record<PaceState, string> = {
  reached: 'Reached',
  onTrack: 'On track',
  atRisk: 'At risk',
  behind: 'Behind',
};

/** How far back a reading has to be to count as "last month". */
export const DELTA_DAYS = 28;

/**
 * The change since roughly a month ago.
 *
 * The comparison is against the most recent reading at least 28 days older
 * than the latest one. Null when the history does not go back that far, which
 * is a different thing from a delta of zero: "no change" is a claim, and a KPI
 * first logged last week has nothing to claim it against.
 */
export function kpiDelta(kpi: Kpi): number | null {
  if (kpi.history.length < 2) return null;
  const latest = kpi.history[kpi.history.length - 1];
  const latestDay = startOfDay(new Date(latest.at));

  for (let index = kpi.history.length - 2; index >= 0; index -= 1) {
    const point = kpi.history[index];
    if (differenceInCalendarDays(latestDay, startOfDay(new Date(point.at))) >= DELTA_DAYS) {
      return latest.value - point.value;
    }
  }
  return null;
}
