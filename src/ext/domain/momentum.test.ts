import { describe, expect, it } from 'vitest';
import { daysSinceLast, momentum, momentumSince, thisWeek, weeklyCounts } from './momentum';

/** Tue 29 Sep 2026, in week 40. */
const NOW = new Date(2026, 8, 29);
const day = (y: number, m: number, d: number) => new Date(y, m - 1, d);

describe('weeklyCounts', () => {
  it('buckets completions into the last eight ISO weeks, oldest first', () => {
    const done = [
      day(2026, 9, 29), day(2026, 9, 28), // this week (40)
      day(2026, 9, 22),                   // week 39
      day(2026, 8, 12),                   // week 33, the oldest in the window
    ];
    expect(weeklyCounts(done, NOW)).toEqual([1, 0, 0, 0, 0, 0, 1, 2]);
  });

  /* A bar per week whether or not anything happened in it. */
  it('is always as long as the window, even with nothing in it', () => {
    expect(weeklyCounts([], NOW)).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    expect(weeklyCounts([], NOW, 4)).toHaveLength(4);
  });

  it('leaves out anything before the window or after now', () => {
    expect(weeklyCounts([day(2026, 8, 3)], NOW)).toEqual(new Array(8).fill(0));
    expect(weeklyCounts([day(2026, 10, 20)], NOW)).toEqual(new Array(8).fill(0));
  });

  it('counts Thu 1 Oct as this week, since week 40 runs to 4 Oct', () => {
    expect(weeklyCounts([day(2026, 10, 1)], NOW)[7]).toBe(1);
  });

  it('asks the completed API for far enough back', () => {
    const since = momentumSince(NOW);
    expect(since.getTime()).toBeLessThan(day(2026, 8, 12).getTime());
    expect(weeklyCounts([since], NOW)[0]).toBe(1);
  });
});

describe('daysSinceLast', () => {
  it('counts from the most recent action, whatever order they arrive in', () => {
    expect(daysSinceLast([day(2026, 9, 1), day(2026, 9, 28), day(2026, 9, 10)], NOW)).toBe(1);
    expect(daysSinceLast([day(2026, 9, 29)], NOW)).toBe(0);
  });

  it('is null when there has never been one', () => {
    expect(daysSinceLast([], NOW)).toBeNull();
  });

  it('never goes negative on a completion dated ahead of now', () => {
    expect(daysSinceLast([day(2026, 10, 5)], NOW)).toBe(0);
  });
});

describe('momentum', () => {
  const since = 1;

  it('rises when the recent half is a fifth bigger', () => {
    expect(momentum([1, 1, 1, 1, 2, 1, 1, 1], since)).toBe('Rising'); // 5 vs 4, ≥ 4.8
    expect(momentum([2, 3, 2, 3, 3, 4, 5, 4], since)).toBe('Rising'); // 16 vs 10
  });

  it('slows when the recent half is down to seven tenths', () => {
    expect(momentum([3, 3, 2, 2, 1, 1, 0, 1], since)).toBe('Slowing'); // 3 vs 10
    expect(momentum([3, 3, 2, 2, 1, 2, 2, 2], since)).toBe('Slowing'); // 7 vs 10, exactly 0.7
  });

  it('is steady in between', () => {
    expect(momentum([3, 3, 2, 2, 2, 2, 2, 2], since)).toBe('Steady'); // 8 vs 10
    expect(momentum([1, 1, 1, 1, 1, 1, 1, 1], since)).toBe('Steady'); // 4 vs 4, ratio 1
  });

  it('sits just either side of the rising line', () => {
    expect(momentum([0, 0, 0, 10, 12, 0, 0, 0], since)).toBe('Rising'); // 12 vs 10, exactly 1.2
    expect(momentum([0, 0, 0, 10, 11, 0, 0, 0], since)).toBe('Steady'); // 11 vs 10
  });

  /* Stalling is checked first and wins outright. */
  it('stalls after a fortnight with nothing done, however good the ratio', () => {
    expect(momentum([0, 0, 0, 0, 5, 5, 5, 5], 15)).toBe('Stalling');
    expect(momentum([0, 0, 0, 0, 5, 5, 5, 5], 14)).toBe('Rising');
  });

  it('stalls with nothing in the recent half', () => {
    expect(momentum([5, 5, 5, 5, 0, 0, 0, 0], since)).toBe('Stalling');
  });

  /* Zero is not less than zero, so an empty eight weeks would read as
     Rising if Stalling were not checked first. */
  it('stalls on an empty window rather than reading it as a rise', () => {
    expect(momentum([0, 0, 0, 0, 0, 0, 0, 0], since)).toBe('Stalling');
    expect(momentum([0, 0, 0, 0, 0, 0, 0, 0], null)).toBe('Stalling');
  });

  it('rises from a standing start', () => {
    expect(momentum([0, 0, 0, 0, 0, 0, 1, 2], since)).toBe('Rising'); // 3 vs 0
  });
});

describe('this week against the floor', () => {
  it('reads the last bar and says whether it clears the floor', () => {
    expect(thisWeek([1, 1, 1, 1, 1, 1, 1, 4], 2)).toEqual({ count: 4, belowFloor: false });
    expect(thisWeek([1, 1, 1, 1, 1, 1, 1, 1], 2)).toEqual({ count: 1, belowFloor: true });
    expect(thisWeek([], 2)).toEqual({ count: 0, belowFloor: true });
  });
});
