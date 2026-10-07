import { describe, expect, it } from 'vitest';
import {
  containsDay, isoWeek, offsetOfDay, parentCadence, parentCandidates, parentPeriod,
  periodBounds, periodKey, periodOf,
} from './periods';

/** Tue 29 Sep 2026. Week 40 straddles the month end and Q3 ends tomorrow. */
const NOW = new Date(2026, 8, 29);
const day = (y: number, m: number, d: number) => new Date(y, m - 1, d);
const iso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

describe('week 40 of 2026', () => {
  it('runs Mon 28 Sep to Sun 4 Oct', () => {
    const week = periodOf('w', 0, NOW);
    expect(iso(week.start)).toBe('2026-09-28');
    expect(iso(week.end)).toBe('2026-10-04');
    expect(isoWeek(week.start)).toBe(40);
  });

  it('says so in its subtitle, with the days left', () => {
    const week = periodOf('w', 0, NOW);
    expect(week.title).toBe('This week');
    expect(week.subtitle).toBe('Week 40 · 28 Sep to 4 Oct · 5 days left');
  });

  it('names the weeks either side', () => {
    expect(periodOf('w', 1, NOW).title).toBe('Next week');
    expect(periodOf('w', -1, NOW).title).toBe('Last week');
    expect(periodOf('w', 3, NOW).title).toBe('Week 43');
    // Only the period in hand counts down.
    expect(periodOf('w', 1, NOW).subtitle).not.toContain('left');
  });
});

describe('the quarter', () => {
  it('ends 30 Sep, the day after now', () => {
    const quarter = periodOf('q', 0, NOW);
    expect(quarter.title).toBe('Q3 2026');
    expect(iso(quarter.start)).toBe('2026-07-01');
    expect(iso(quarter.end)).toBe('2026-09-30');
    expect(quarter.subtitle).toBe('1 Jul to 30 Sep · 1 day left');
  });

  it('steps into Q4 and back into Q2', () => {
    expect(periodOf('q', 1, NOW).title).toBe('Q4 2026');
    expect(periodOf('q', -1, NOW).title).toBe('Q2 2026');
    expect(periodOf('q', 2, NOW).title).toBe('Q1 2027');
  });
});

describe('the day and the month', () => {
  it('names today, tomorrow and yesterday', () => {
    expect(periodOf('d', 0, NOW).title).toBe('Today');
    expect(periodOf('d', 1, NOW).title).toBe('Tomorrow');
    expect(periodOf('d', -1, NOW).title).toBe('Yesterday');
    expect(periodOf('d', 2, NOW).title).toBe('Thu 1 Oct');
  });

  it('runs a month from the 1st to its last day', () => {
    const month = periodOf('m', 0, NOW);
    expect(month.title).toBe('September 2026');
    expect(iso(month.start)).toBe('2026-09-01');
    expect(iso(month.end)).toBe('2026-09-30');
    expect(month.subtitle).toBe('1 to 30 Sep · 1 day left');
  });

  it('crosses a year end', () => {
    expect(periodOf('m', 4, NOW).title).toBe('January 2027');
    expect(iso(periodBounds('m', 4, NOW).end)).toBe('2027-01-31');
  });

  it('counts February right in a leap year', () => {
    expect(iso(periodBounds('m', 0, day(2028, 2, 10)).end)).toBe('2028-02-29');
  });
});

describe('periodKey', () => {
  it('files a note under its period', () => {
    expect(periodKey('d', NOW)).toBe('d:2026-09-29');
    expect(periodKey('w', NOW)).toBe('w:2026-W40');
    expect(periodKey('m', NOW)).toBe('m:2026-09');
    expect(periodKey('q', NOW)).toBe('q:2026-Q3');
  });

  /* The last days of December belong to the next year's week 1, and filing
     them under the calendar year would put two different weeks in one key. */
  it('uses the ISO week-numbering year, not the calendar year', () => {
    expect(periodKey('w', day(2026, 12, 31))).toBe('w:2026-W53');
    expect(periodKey('w', day(2024, 12, 31))).toBe('w:2025-W01');
  });
});

describe('what a period supports', () => {
  it('goes up one level and stops at the quarter', () => {
    expect(parentCadence('d')).toBe('w');
    expect(parentCadence('w')).toBe('m');
    expect(parentCadence('m')).toBe('q');
    expect(parentCadence('q')).toBeNull();
  });

  /* The rule this date was chosen for: week 40 runs 28 Sep to 4 Oct, so four
     of its seven days are in October — and it supports September, because
     that is the month it starts in. */
  it('a week that starts in September belongs to September', () => {
    const parent = parentPeriod('w', 0, NOW);
    expect(parent?.title).toBe('September 2026');
  });

  it('the following week belongs to October', () => {
    expect(parentPeriod('w', 1, NOW)?.title).toBe('October 2026');
  });

  it('a day in week 40 belongs to week 40, either side of the month end', () => {
    expect(parentPeriod('d', 0, NOW)?.subtitle).toContain('Week 40');
    // Thu 1 Oct is still week 40.
    expect(parentPeriod('d', 2, NOW)?.subtitle).toContain('Week 40');
    // Mon 5 Oct is week 41.
    expect(parentPeriod('d', 6, NOW)?.subtitle).toContain('Week 41');
  });

  it('September belongs to Q3, October to Q4', () => {
    expect(parentPeriod('m', 0, NOW)?.title).toBe('Q3 2026');
    expect(parentPeriod('m', 1, NOW)?.title).toBe('Q4 2026');
  });
});

describe('parentCandidates', () => {
  const dayOf = (o: { due: Date }) => o.due;

  it('keeps only the objectives whose period holds this one’s start', () => {
    const objectives = [
      { name: 'September', due: day(2026, 9, 30) },
      { name: 'October', due: day(2026, 10, 31) },
      { name: 'August', due: day(2026, 8, 31) },
    ];
    // This week starts 28 Sep, so only the September objective can hold it.
    expect(parentCandidates(objectives, dayOf, 'w', 0, NOW).map((o) => o.name))
      .toEqual(['September']);
    // Next week starts 5 Oct.
    expect(parentCandidates(objectives, dayOf, 'w', 1, NOW).map((o) => o.name))
      .toEqual(['October']);
  });

  it('offers nothing above a quarter, and skips an objective with no date', () => {
    expect(parentCandidates([{ due: NOW }], dayOf, 'q', 0, NOW)).toEqual([]);
    expect(parentCandidates(
      [{ due: null as unknown as Date }], dayOf, 'w', 0, NOW,
    )).toEqual([]);
  });
});

describe('placing a day', () => {
  it('counts how many periods away it is', () => {
    expect(offsetOfDay('d', day(2026, 10, 1), NOW)).toBe(2);
    expect(offsetOfDay('w', day(2026, 10, 5), NOW)).toBe(1);
    // Still week 40, so still this week.
    expect(offsetOfDay('w', day(2026, 10, 4), NOW)).toBe(0);
    expect(offsetOfDay('m', day(2027, 1, 15), NOW)).toBe(4);
    expect(offsetOfDay('q', day(2026, 10, 1), NOW)).toBe(1);
    expect(offsetOfDay('q', day(2025, 12, 31), NOW)).toBe(-3);
  });

  it('holds a day inside its period, ends included', () => {
    const week = periodOf('w', 0, NOW);
    expect(containsDay(week, day(2026, 9, 28))).toBe(true);
    expect(containsDay(week, day(2026, 10, 4))).toBe(true);
    expect(containsDay(week, day(2026, 10, 5))).toBe(false);
    expect(containsDay(week, day(2026, 9, 27))).toBe(false);
  });
});
