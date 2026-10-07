import { describe, expect, it } from 'vitest';
import type { Kpi } from '@/ext/data/types';
import {
  daysLeftInYear, elapsedShare, goalYearStart, kpiDelta, kpiPace, kpiValue, paceState,
  paceSummary,
} from './pace';

/** Tue 29 Sep 2026: 271 of 365 days gone, a shade under 75%. */
const NOW = new Date(2026, 8, 29);

const kpi = (overrides: Partial<Kpi> = {}): Kpi => ({
  id: 'k1', goal: 'g1', name: 'Adoption', unit: '%',
  start: 0, target: 100, history: [], ...overrides,
});

const at = (date: string, value: number) => ({ at: date, value });

describe('the share of the year gone', () => {
  it('is about three quarters on 29 Sep', () => {
    expect(elapsedShare(NOW)).toBeCloseTo(271 / 365, 5);
    expect(Math.round(elapsedShare(NOW) * 100)).toBe(74);
    expect(daysLeftInYear(NOW)).toBe(94);
  });

  it('is 0 on the first day and never more than 1', () => {
    expect(elapsedShare(new Date(2026, 0, 1))).toBe(0);
    expect(elapsedShare(new Date(2026, 11, 31))).toBeLessThan(1);
    expect(elapsedShare(new Date(2027, 0, 1))).toBe(0);
  });

  /* A financial year starting in April: on 29 Sep not quite half has gone. */
  it('follows a year that does not start in January', () => {
    expect(goalYearStart(NOW, 4).getMonth()).toBe(3);
    expect(goalYearStart(NOW, 4).getFullYear()).toBe(2026);
    expect(elapsedShare(NOW, 4)).toBeCloseTo(181 / 365, 5);
  });

  it('reaches back into last year when the year has not started yet', () => {
    const march = new Date(2026, 2, 1);
    expect(goalYearStart(march, 4).getFullYear()).toBe(2025);
  });
});

describe('kpiPace', () => {
  const elapsed = elapsedShare(NOW);

  it('reads the latest value, or the start when nothing is logged', () => {
    expect(kpiValue(kpi())).toBe(0);
    expect(kpiValue(kpi({ history: [at('2026-01-01', 5), at('2026-06-01', 30)] }))).toBe(30);
  });

  it('is on track when progress keeps up with the year', () => {
    const pace = kpiPace(kpi({ history: [at('2026-09-01', 80)] }), NOW);
    expect(pace.progress).toBeCloseTo(0.8);
    expect(pace.elapsed).toBeCloseTo(elapsed);
    expect(pace.state).toBe('onTrack');
  });

  it('is reached once the target is met, however early', () => {
    expect(kpiPace(kpi({ history: [at('2026-02-01', 100)] }), NOW).state).toBe('reached');
    expect(kpiPace(kpi({ history: [at('2026-02-01', 120)] }), NOW).state).toBe('reached');
  });

  it('is at risk, then behind, as it falls further back', () => {
    // elapsed ≈ 0.742: at risk from 0.520, on track from 0.692.
    expect(kpiPace(kpi({ history: [at('2026-09-01', 60)] }), NOW).state).toBe('atRisk');
    expect(kpiPace(kpi({ history: [at('2026-09-01', 30)] }), NOW).state).toBe('behind');
  });

  /* A KPI measured once a month must not read "at risk" for the three weeks
     between readings. */
  it('gives five points of grace before calling it at risk', () => {
    expect(paceState(0.742, 0.742)).toBe('onTrack');
    expect(paceState(0.6925, 0.742)).toBe('onTrack');
    expect(paceState(0.6915, 0.742)).toBe('atRisk');
  });

  it('is behind below seven tenths of the elapsed share', () => {
    expect(paceState(0.52, 0.742)).toBe('atRisk');
    expect(paceState(0.519, 0.742)).toBe('behind');
  });

  /* Going from 40 down to 10 has both differences negative, so the same
     ratio rises as the number improves. No flag, no special case. */
  it('handles a KPI where lower is better', () => {
    const churn = kpi({ start: 40, target: 10 });
    expect(kpiPace({ ...churn, history: [at('2026-09-01', 40)] }, NOW).progress).toBe(0);
    expect(kpiPace({ ...churn, history: [at('2026-09-01', 25)] }, NOW).progress).toBeCloseTo(0.5);
    expect(kpiPace({ ...churn, history: [at('2026-09-01', 10)] }, NOW).state).toBe('reached');
    expect(kpiPace({ ...churn, history: [at('2026-09-01', 16)] }, NOW).state).toBe('onTrack');
    // Going the wrong way.
    expect(kpiPace({ ...churn, history: [at('2026-09-01', 45)] }, NOW).progress).toBeLessThan(0);
    expect(kpiPace({ ...churn, history: [at('2026-09-01', 45)] }, NOW).state).toBe('behind');
  });

  /* The one that would divide by zero. */
  it('handles target equal to start', () => {
    const hold = kpi({ start: 5, target: 5 });
    expect(kpiPace({ ...hold, history: [at('2026-09-01', 5)] }, NOW).state).toBe('reached');
    expect(kpiPace({ ...hold, history: [at('2026-09-01', 4)] }, NOW).state).toBe('behind');
    expect(kpiPace({ ...hold, history: [at('2026-09-01', 6)] }, NOW).state).toBe('behind');
    expect(Number.isFinite(kpiPace(hold, NOW).progress)).toBe(true);
  });
});

describe('kpiDelta', () => {
  it('compares against the newest reading at least 28 days older', () => {
    const k = kpi({ history: [at('2026-07-01', 10), at('2026-08-25', 30), at('2026-09-29', 44)] });
    // 25 Aug is 35 days before 29 Sep, so that is the comparison.
    expect(kpiDelta(k)).toBe(14);
  });

  it('skips a reading that is too recent to count as last month', () => {
    const k = kpi({ history: [at('2026-06-01', 10), at('2026-09-20', 40), at('2026-09-29', 44)] });
    expect(kpiDelta(k)).toBe(34);
  });

  /* "No change" is a claim, and a KPI first logged last week has nothing to
     claim it against — which is not the same as a delta of zero. */
  it('is null when the history does not go back a month', () => {
    expect(kpiDelta(kpi())).toBeNull();
    expect(kpiDelta(kpi({ history: [at('2026-09-29', 44)] }))).toBeNull();
    expect(kpiDelta(kpi({ history: [at('2026-09-20', 40), at('2026-09-29', 44)] }))).toBeNull();
  });

  it('reports a real standstill as zero, not as nothing', () => {
    const k = kpi({ history: [at('2026-07-01', 30), at('2026-09-29', 30)] });
    expect(kpiDelta(k)).toBe(0);
  });

  it('goes negative when the number fell', () => {
    expect(kpiDelta(kpi({ history: [at('2026-07-01', 30), at('2026-09-29', 22)] }))).toBe(-8);
  });

  it('counts 28 days as a month, exactly on the boundary', () => {
    expect(kpiDelta(kpi({ history: [at('2026-09-01', 10), at('2026-09-29', 15)] }))).toBe(5);
    expect(kpiDelta(kpi({ history: [at('2026-09-02', 10), at('2026-09-29', 15)] }))).toBeNull();
  });
});

describe('paceSummary', () => {
  const at = (date: string, value: number) => ({ at: date, value });

  /* A KPI already at its target is not a worry, so it counts as on track
     rather than earning a tally of its own. */
  it('counts reached as on track', () => {
    const reached = kpi({ history: [at('2026-02-01', 100)] });
    expect(paceSummary([reached], NOW)).toEqual({ onTrack: 1, atRisk: 0, behind: 0 });
  });

  it('sorts a mixed set into the three', () => {
    const kpis = [
      kpi({ id: 'a', history: [at('2026-09-01', 80)] }),   // on track
      kpi({ id: 'b', history: [at('2026-09-01', 100)] }),  // reached
      kpi({ id: 'c', history: [at('2026-09-01', 60)] }),   // at risk
      kpi({ id: 'd', history: [at('2026-09-01', 10)] }),   // behind
    ];
    expect(paceSummary(kpis, NOW)).toEqual({ onTrack: 2, atRisk: 1, behind: 1 });
  });

  it('counts nothing from nothing', () => {
    expect(paceSummary([], NOW)).toEqual({ onTrack: 0, atRisk: 0, behind: 0 });
  });
});
