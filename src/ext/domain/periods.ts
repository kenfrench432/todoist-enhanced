import {
  addDays, addMonths, addQuarters, addWeeks, differenceInCalendarDays, endOfISOWeek,
  endOfMonth, endOfQuarter, format, getISOWeek, isWithinInterval, startOfDay,
  startOfISOWeek, startOfMonth, startOfQuarter,
} from 'date-fns';

/**
 * The day, week, month and quarter an objective can belong to.
 *
 * Every function here takes "now" rather than reading the clock, so a period
 * that straddles a month end — week 40 of 2026 runs 28 Sep to 4 Oct — can be
 * tested on the day that makes it awkward.
 */

export const CADENCES = ['d', 'w', 'm', 'q'] as const;
export type Cadence = (typeof CADENCES)[number];

export interface Period {
  cadence: Cadence;
  start: Date;
  /** The last day of the period, at its start of day. */
  end: Date;
  /** "Today", "This week", "September 2026", "Q3 2026". */
  title: string;
  /** "Week 40 · 28 Sep to 4 Oct · 5 days left". */
  subtitle: string;
}

/** The ISO week number: weeks run Monday to Sunday, week 1 holds 4 January. */
export const isoWeek = (date: Date): number => getISOWeek(date);

const shortDay = (date: Date): string => format(date, 'd MMM');

/** "ends today", "1 day left", "5 days left" — only said of the period in hand. */
function daysLeft(end: Date, now: Date): string {
  const left = differenceInCalendarDays(end, now);
  if (left <= 0) return 'ends today';
  return left === 1 ? '1 day left' : `${left} days left`;
}

/** The bounds of a period, with no words attached. */
export function periodBounds(cadence: Cadence, offset: number, now: Date): {
  start: Date; end: Date;
} {
  const today = startOfDay(now);
  switch (cadence) {
    case 'd': {
      const start = addDays(today, offset);
      return { start, end: start };
    }
    case 'w': {
      const start = startOfISOWeek(addWeeks(today, offset));
      return { start, end: startOfDay(endOfISOWeek(start)) };
    }
    case 'm': {
      const start = startOfMonth(addMonths(today, offset));
      return { start, end: startOfDay(endOfMonth(start)) };
    }
    default: {
      const start = startOfQuarter(addQuarters(today, offset));
      return { start, end: startOfDay(endOfQuarter(start)) };
    }
  }
}

/** A period, with the words the page puts at the top of it. */
export function periodOf(cadence: Cadence, offset: number, now: Date): Period {
  const { start, end } = periodBounds(cadence, offset, now);
  const left = offset === 0 ? ` · ${daysLeft(end, now)}` : '';

  switch (cadence) {
    case 'd':
      return {
        cadence, start, end,
        title: offset === 0 ? 'Today'
          : offset === 1 ? 'Tomorrow'
            : offset === -1 ? 'Yesterday'
              : format(start, 'EEE d MMM'),
        subtitle: format(start, 'EEEE d MMMM yyyy'),
      };
    case 'w':
      return {
        cadence, start, end,
        title: offset === 0 ? 'This week'
          : offset === 1 ? 'Next week'
            : offset === -1 ? 'Last week'
              : `Week ${isoWeek(start)}`,
        subtitle: `Week ${isoWeek(start)} · ${shortDay(start)} to ${shortDay(end)}${left}`,
      };
    case 'm':
      return {
        cadence, start, end,
        title: format(start, 'MMMM yyyy'),
        subtitle: `1 to ${shortDay(end)}${left}`,
      };
    default:
      return {
        cadence, start, end,
        title: `Q${Math.floor(start.getMonth() / 3) + 1} ${start.getFullYear()}`,
        subtitle: `${shortDay(start)} to ${shortDay(end)}${left}`,
      };
  }
}

/**
 * The key a period's note is filed under.
 *
 * 'd:2026-09-29' | 'w:2026-W40' | 'm:2026-09' | 'q:2026-Q3'. The week uses the
 * ISO week-numbering year, not the calendar year, or the last days of December
 * would file under the wrong year's week 1.
 */
export function periodKey(cadence: Cadence, date: Date): string {
  switch (cadence) {
    case 'd': return `d:${format(date, 'yyyy-MM-dd')}`;
    case 'w': return `w:${format(date, 'RRRR')}-W${String(isoWeek(date)).padStart(2, '0')}`;
    case 'm': return `m:${format(date, 'yyyy-MM')}`;
    default: return `q:${date.getFullYear()}-Q${Math.floor(date.getMonth() / 3) + 1}`;
  }
}

/** The cadence one level up: a day supports a week, a week a month, and so on. */
export function parentCadence(cadence: Cadence): Cadence | null {
  const next: Record<Cadence, Cadence | null> = { d: 'w', w: 'm', m: 'q', q: null };
  return next[cadence];
}

/** Whether a date falls inside a period, ends included. */
export const containsDay = (period: { start: Date; end: Date }, day: Date): boolean =>
  isWithinInterval(startOfDay(day), { start: period.start, end: period.end });

/**
 * The period one level up that this one supports.
 *
 * Decided by the period's **start**, not by where most of it falls. Week 40 of
 * 2026 runs 28 Sep to 4 Oct — four of its seven days are in October — and it
 * supports **September**, because that is the month it starts in. Anything else
 * and a week would support two months, or none.
 */
export function parentPeriod(cadence: Cadence, offset: number, now: Date): Period | null {
  const up = parentCadence(cadence);
  if (!up) return null;
  const { start } = periodBounds(cadence, offset, now);
  return periodOfDay(up, start, now);
}

/** The period of a given cadence that holds this day. */
export function periodOfDay(cadence: Cadence, day: Date, now: Date): Period {
  /* Walked rather than computed: offsets are what the page navigates by, so
     the period that comes back is one ‹ › can step away from. */
  const offset = offsetOfDay(cadence, day, now);
  return periodOf(cadence, offset, now);
}

/** How many periods away from today a given day falls. */
export function offsetOfDay(cadence: Cadence, day: Date, now: Date): number {
  const target = startOfDay(day);
  const today = startOfDay(now);
  switch (cadence) {
    case 'd':
      return differenceInCalendarDays(target, today);
    case 'w':
      return Math.round(
        differenceInCalendarDays(startOfISOWeek(target), startOfISOWeek(today)) / 7,
      );
    case 'm':
      return (target.getFullYear() - today.getFullYear()) * 12
        + (target.getMonth() - today.getMonth());
    default:
      return (target.getFullYear() - today.getFullYear()) * 4
        + (Math.floor(target.getMonth() / 3) - Math.floor(today.getMonth() / 3));
  }
}

/**
 * The objectives a level up that this period can be filed under.
 *
 * `dayOf` says which day an objective's period starts on — its due date is the
 * last day of its period, so the caller passes that in. Only the one parent
 * period can hold it, so this is a filter rather than a search.
 */
export function parentCandidates<T>(
  objectives: T[],
  dayOf: (objective: T) => Date | null,
  cadence: Cadence,
  offset: number,
  now: Date,
): T[] {
  const parent = parentPeriod(cadence, offset, now);
  if (!parent) return [];
  return objectives.filter((objective) => {
    const day = dayOf(objective);
    return day !== null && containsDay(parent, day);
  });
}
