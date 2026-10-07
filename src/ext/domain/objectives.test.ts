import { describe, expect, it } from 'vitest';
import { item } from '@/test/items';
import { defaultSettings } from '@/ext/data/defaults';
import type { CompletedItem } from '@/domain/types';
import { due } from '@/test/items';
import { periodOf } from './periods';
import {
  PROMPTS, cadenceCounts, capFor, capacity, dueForPeriod, labelsForObjective, mergeCompleted,
  moveToNext, objectivesIn, objectivesInPeriod, readObjective,
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

describe('objectivesInPeriod', () => {
  const week = periodOf('w', 0, NOW);   // Mon 28 Sep to Sun 4 Oct
  const obj = (id: string, date: string, over: Record<string, unknown> = {}) =>
    item({ id, labels: ['objective', 'period-week'], due: due(date), ...over });

  /* An objective is placed by its due date — the last day of its period —
     not by when it happened to be finished. */
  it('takes the objectives due inside the period', () => {
    const items = [
      obj('in-start', '2026-09-28'),
      obj('in-end', '2026-10-04'),
      obj('before', '2026-09-27'),
      obj('after', '2026-10-05'),
    ];
    expect(objectivesInPeriod(items, settings, 'w', week).map((i) => i.id))
      .toEqual(['in-start', 'in-end']);
  });

  /* The point of reading the snapshot rather than openItems: a completed
     objective still counts towards its period's "2 of 3 done". */
  it('keeps completed objectives, so the period still counts them', () => {
    const items = [obj('open', '2026-10-04'), obj('done', '2026-10-04', { checked: true })];
    expect(objectivesInPeriod(items, settings, 'w', week)).toHaveLength(2);
    expect(cadenceCounts(objectivesInPeriod(items, settings, 'w', week)))
      .toEqual({ done: 1, total: 2 });
  });

  it('leaves out other cadences, other tasks, and anything undated', () => {
    const items = [
      obj('mine', '2026-10-04'),
      item({ id: 'daily', labels: ['objective', 'period-day'], due: due('2026-10-04') }),
      item({ id: 'task', labels: ['week'], due: due('2026-10-04') }),
      item({ id: 'undated', labels: ['objective', 'period-week'] }),
    ];
    expect(objectivesInPeriod(items, settings, 'w', week).map((i) => i.id)).toEqual(['mine']);
  });

  it('ignores a deleted objective', () => {
    const items = [obj('gone', '2026-10-04', { is_deleted: true })];
    expect(objectivesInPeriod(items, settings, 'w', week)).toEqual([]);
  });
});

describe('mergeCompleted', () => {
  const week = periodOf('w', 0, NOW);
  const row = (id: string, at: string, labels: string[]): CompletedItem => ({
    id, user_id: 'u', project_id: 'p', section_id: null, content: id, completed_at: at, labels,
  });

  it('recovers an objective the snapshot no longer has', () => {
    const rows = [row('gone', '2026-09-30T09:00:00Z', ['objective', 'period-week'])];
    expect(mergeCompleted([], rows, settings, 'w', week).map((r) => r.id)).toEqual(['gone']);
  });

  /* The snapshot knows the due date, so anything it holds wins outright and
     must not be counted twice. */
  it('never duplicates one the snapshot already has', () => {
    const kept = item({ id: 'k1', labels: ['objective', 'period-week'], due: due('2026-10-04'), checked: true });
    const rows = [row('k1', '2026-09-30T09:00:00Z', ['objective', 'period-week'])];
    expect(mergeCompleted([kept], rows, settings, 'w', week)).toEqual([]);
  });

  it('matches a row by its task_id when it carries one', () => {
    const kept = item({ id: 'task-1', labels: ['objective', 'period-week'], due: due('2026-10-04') });
    const rows = [{ ...row('completion-9', '2026-09-30T09:00:00Z', ['objective', 'period-week']), task_id: 'task-1' }];
    expect(mergeCompleted([kept], rows, settings, 'w', week)).toEqual([]);
  });

  it('wants both the marker and the right cadence', () => {
    const rows = [
      row('no-marker', '2026-09-30T09:00:00Z', ['period-week']),
      row('wrong-cadence', '2026-09-30T09:00:00Z', ['objective', 'period-day']),
    ];
    expect(mergeCompleted([], rows, settings, 'w', week)).toEqual([]);
  });

  it('leaves out anything finished outside the period', () => {
    const rows = [row('late', '2026-10-09T09:00:00Z', ['objective', 'period-week'])];
    expect(mergeCompleted([], rows, settings, 'w', week)).toEqual([]);
  });
});

describe('cadenceCounts and the prompts', () => {
  it('counts the recovered ones as done too', () => {
    const items = [item({ id: 'a', checked: true }), item({ id: 'b' })];
    expect(cadenceCounts(items, 2)).toEqual({ done: 3, total: 4 });
  });

  it('has a start and an end prompt for every cadence', () => {
    for (const cadence of ['d', 'w', 'm', 'q'] as const) {
      expect(PROMPTS[cadence].start.length).toBeGreaterThan(0);
      expect(PROMPTS[cadence].end.length).toBeGreaterThan(0);
    }
  });
});
