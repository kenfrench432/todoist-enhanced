import { describe, expect, it } from 'vitest';
import { DEFAULT_STAGES, defaultExtData } from './defaults';
import { EXT_VERSION, migrate } from './migrate';

describe('migrate', () => {
  it('gives an account that has never used the fork the defaults', () => {
    const data = migrate(undefined);
    expect(data.v).toBe(EXT_VERSION);
    expect(data.stages).toEqual(DEFAULT_STAGES);
    expect(data.focusAreas).toHaveLength(3);
    expect(data.customers).toEqual([]);
    expect(data.settings.objectiveCaps).toEqual({ d: 3, w: 5, m: 3, q: 3 });
  });

  /* Anything at all can end up in a comment somebody edited by hand, and none
     of it may stop the app from opening. */
  it.each([null, 42, 'nonsense', [], true])('survives %p', (input) => {
    expect(() => migrate(input)).not.toThrow();
    expect(migrate(input)).toEqual(defaultExtData());
  });

  it('upgrades a document written before there was a version', () => {
    const data = migrate({
      savedAt: 10,
      customers: [{ id: 'c1', name: 'Aston Martin', label: 'aston-martin', stage: 'healthy', tier: 'P1', color: 'green', csm: null }],
    });
    expect(data.v).toBe(EXT_VERSION);
    expect(data.savedAt).toBe(10);
    expect(data.customers[0].name).toBe('Aston Martin');
    // Everything it never had comes from the defaults.
    expect(data.stages).toEqual(DEFAULT_STAGES);
    expect(data.settings.soonDays).toBe(7);
  });

  it('keeps the fields it knows from a document written by a newer build', () => {
    const data = migrate({ v: 99, savedAt: 5, settings: { soonDays: 14 }, nextThing: 'ignored' });
    expect(data.v).toBe(EXT_VERSION);
    expect(data.settings.soonDays).toBe(14);
    expect(data).not.toHaveProperty('nextThing');
  });

  it('fills a field back in rather than dropping it when it is unreadable', () => {
    const data = migrate({ v: 1, settings: { soonDays: 'soon', objectiveCaps: { d: 9 } } });
    expect(data.settings.soonDays).toBe(7);
    expect(data.settings.objectiveCaps).toEqual({ d: 9, w: 5, m: 3, q: 3 });
  });

  it('always leaves a stage for a customer to be at', () => {
    expect(migrate({ v: 1, stages: [] }).stages).toEqual(DEFAULT_STAGES);
    expect(migrate({ v: 1, stages: [{ name: 'no id' }] }).stages).toEqual(DEFAULT_STAGES);
  });

  it('drops rows with no id, and a repeated id', () => {
    const data = migrate({
      v: 1,
      csms: [{ id: 'a', name: 'Alex' }, { name: 'nameless' }, { id: 'a', name: 'Alex again' }],
    });
    expect(data.csms).toEqual([{ id: 'a', name: 'Alex' }]);
  });

  it('gives a stage an id it does not know rather than inventing one', () => {
    const data = migrate({
      v: 1,
      stages: [{ id: 's1', name: 'Only', tone: 'blue' }],
      customers: [{ id: 'c1', name: 'C', label: 'c' }],
    });
    // No stage on the customer: it goes to the first one the document has.
    expect(data.customers[0].stage).toBe('s1');
  });

  it('keeps the custom order to customers that exist, each once', () => {
    const data = migrate({
      v: 1,
      customers: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
      customerOrder: ['b', 'gone', 'a', 'b', 7],
    });
    expect(data.customerOrder).toEqual(['b', 'a']);
  });

  it('puts a KPI history in date order and drops malformed points', () => {
    const data = migrate({
      v: 1,
      kpis: [{
        id: 'k1', goal: 'g1', name: 'Adoption', unit: '%', start: 10, target: 50,
        history: [{ at: '2026-03-01', value: 20 }, { at: '2026-01-01', value: 12 }, { at: '2026-02-01' }],
      }],
    });
    expect(data.kpis[0].history).toEqual([
      { at: '2026-01-01', value: 12 },
      { at: '2026-03-01', value: 20 },
    ]);
  });

  it('is idempotent: migrating a migrated document changes nothing', () => {
    const once = migrate({ v: 1, savedAt: 3, customers: [{ id: 'c', name: 'C', label: 'c' }] });
    expect(migrate(once)).toEqual(once);
  });
});
