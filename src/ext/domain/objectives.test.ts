import { describe, expect, it } from 'vitest';
import { item } from '@/test/items';
import { defaultSettings } from '@/ext/data/defaults';
import {
  capFor, capacity, dueForPeriod, labelsForObjective, moveToNext, objectivesIn, readObjective,
} from './objectives';

/** Tue 29 Sep 2026. Week 40 runs 28 Sep to 4 Oct; Q3 ends 30 Sep. */
const NOW = new Date(2026, 8, 29);
const settings = defaultSettings();
const day = (y: number, m: number, d: number) => new Date(y, m - 1, d);

describe('readObjective', () => {
  it('reads the cadence and the focus off the task', () => {
    const task = item({ labels: ['objective', 'period-week', 'focus-tsm-value'] });
    expect(readObjective(task, settings)).toEqual({ cadence: 'w', focus: 'tsm-value' });
  });

  it('maps every period name', () => {
    for (const [name, cadence] of [['day', 'd'], ['week', 'w'], ['month', 'm'], ['quarter', 'q']]) {
      expect(readObjective(item({ labels: ['objective', `period-${name}`] }), settings).cadence)
        .toBe(cadence);
    }
  });

  it('has no cadence when the label is missing or unknown', () => {
    expect(readObjective(item({ labels: ['objective'] }), settings).cadence).toBeNull();
    expect(readObjective(item({ labels: ['objective', 'period-fortnight'] }), settings).cadence)
      .toBeNull();
  });
});

describe('dueForPeriod', () => {
  /* A weekly objective is due on Sunday, not spread across the week, so a
     plain Todoist view still shows it on the day it has to be true by. */
  it('is the last day of the period', () => {
    expect(dueForPeriod('d', 0, NOW)).toBe('2026-09-29');
    expect(dueForPeriod('w', 0, NOW)).toBe('2026-10-04');
    expect(dueForPeriod('m', 0, NOW)).toBe('2026-09-30');
    expect(dueForPeriod('q', 0, NOW)).toBe('2026-09-30');
  });

  it('follows the offset into the next period', () => {
    expect(dueForPeriod('w', 1, NOW)).toBe('2026-10-11');
    expect(dueForPeriod('q', 1, NOW)).toBe('2026-12-31');
    expect(dueForPeriod('m', 4, NOW)).toBe('2027-01-31');
  });
});

describe('moveToNext', () => {
  it('moves to the next period’s end', () => {
    expect(moveToNext('w', 0, NOW).due).toBe('2026-10-11');
    expect(moveToNext('d', 0, NOW).due).toBe('2026-09-30');
  });

  /* Week 41 starts on 5 October, so a September parent cannot hold it. */
  it('drops a parent whose period no longer holds the new one', () => {
    const september = day(2026, 9, 30);
    expect(moveToNext('w', 0, NOW, september)).toEqual({
      due: '2026-10-11', dropParent: true,
    });
  });

  it('keeps a parent that still fits', () => {
    // Moving this week to next week, under an October parent: week 41 is in October.
    const october = day(2026, 10, 31);
    expect(moveToNext('w', 0, NOW, october).dropParent).toBe(false);
    // A day moved from Tue 29 Sep to Wed 30 Sep is still in week 40.
    expect(moveToNext('d', 0, NOW, day(2026, 10, 4)).dropParent).toBe(false);
  });

  it('drops a week parent when the day crosses into the next week', () => {
    // Sun 4 Oct moved to Mon 5 Oct leaves week 40.
    expect(moveToNext('d', 5, NOW, day(2026, 10, 4)).dropParent).toBe(true);
  });

  it('has nothing to drop when there is no parent', () => {
    expect(moveToNext('w', 0, NOW, null).dropParent).toBe(false);
  });

  it('leaves a quarter alone: there is no level above it', () => {
    expect(moveToNext('q', 0, NOW, day(2026, 1, 1)).dropParent).toBe(false);
  });

  it('drops a month parent when the quarter changes', () => {
    // September moved to October: its Q3 parent cannot hold Q4's month.
    expect(moveToNext('m', 0, NOW, day(2026, 9, 30)).dropParent).toBe(true);
    // October moved to November is still Q4.
    expect(moveToNext('m', 1, NOW, day(2026, 12, 31)).dropParent).toBe(false);
  });
});

describe('labelsForObjective', () => {
  it('builds what a new objective needs', () => {
    expect(labelsForObjective([], settings, { cadence: 'w', focus: 'tsm-value' }))
      .toEqual(['objective', 'period-week', 'focus-tsm-value']);
  });

  it('swaps the period when an objective moves cadence', () => {
    expect(labelsForObjective(['objective', 'period-day'], settings, { cadence: 'w' }))
      .toEqual(['objective', 'period-week']);
  });

  it('allows an objective with no focus area', () => {
    expect(labelsForObjective(['objective', 'period-week', 'focus-x'], settings, { focus: null }))
      .toEqual(['objective', 'period-week']);
  });
});

describe('capacity', () => {
  const objectives = (open: number, done: number) => [
    ...Array.from({ length: done }, (_, i) => item({ id: `d${i}`, checked: true })),
    ...Array.from({ length: open }, (_, i) => item({ id: `o${i}` })),
  ];

  it('counts open, done and the free slots left', () => {
    expect(capacity(objectives(2, 1), 3)).toMatchObject({ open: 2, done: 1, total: 3, over: false });
    expect(capacity(objectives(2, 1), 3).slots).toEqual(['done', 'open', 'open']);
  });

  it('shows the empty slots when there is room', () => {
    expect(capacity(objectives(1, 0), 3).slots).toEqual(['open', 'free', 'free']);
    expect(capacity([], 3).slots).toEqual(['free', 'free', 'free']);
  });

  /* The cap is a nudge, not a rule: going over is shown, never refused. */
  it('shows the ones over the cap rather than hiding them', () => {
    const over = capacity(objectives(4, 1), 3);
    expect(over).toMatchObject({ open: 4, done: 1, total: 5, over: true });
    expect(over.slots).toEqual(['done', 'open', 'open', 'over', 'over']);
  });

  it('takes the cap for each cadence from settings', () => {
    expect(capFor('d', settings)).toBe(3);
    expect(capFor('w', settings)).toBe(5);
    expect(capFor('m', settings)).toBe(3);
    expect(capFor('q', settings)).toBe(3);
  });
});

describe('objectivesIn', () => {
  it('takes the objectives of one cadence, done ones included', () => {
    const items = [
      item({ id: 'w1', labels: ['objective', 'period-week'] }),
      item({ id: 'w2', labels: ['objective', 'period-week'], checked: true }),
      item({ id: 'd1', labels: ['objective', 'period-day'] }),
      item({ id: 'x', labels: ['initiative'] }),
    ];
    expect(objectivesIn(items, settings, 'w').map((i) => i.id)).toEqual(['w1', 'w2']);
  });
});
