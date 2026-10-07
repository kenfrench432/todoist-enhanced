import { describe, expect, it } from 'vitest';
import { emptySnapshot, type Label, type Snapshot } from '@/domain/types';
import { item } from '@/test/items';
import { defaultSettings } from '@/ext/data/defaults';
import type { Customer, FocusArea, Goal } from '@/ext/data/types';
import {
  customerCounts, duplicateName, goalGroups, goalLinkCounts, targetDeadline, unlinkedLabels,
} from './manage';

const NOW = new Date(2026, 8, 29);
const settings = defaultSettings();

const customer = (id: string, label: string, name = id): Customer =>
  ({ id, name, label, csm: null, stage: 'healthy', tier: 'P2', color: 'green' });

function snapshotWithLabels(names: string[]): Snapshot {
  const snapshot = emptySnapshot();
  names.forEach((name, index) => {
    snapshot.labels[`l${index}`] = { id: `l${index}`, name, color: 'charcoal', is_deleted: false } as Label;
  });
  return snapshot;
}

describe('unlinkedLabels', () => {
  it('lists the labels that are nobody’s', () => {
    const snapshot = snapshotWithLabels(['avon', 'northwind-foods', 'engagement', 'week']);
    expect(unlinkedLabels(snapshot, [customer('avon', 'avon')], settings))
      .toEqual(['northwind-foods']);
  });

  it('leaves out every marker label', () => {
    const snapshot = snapshotWithLabels([
      'engagement', 'initiative', 'objective',
      'period-week', 'focus-tsm-value', 'status-active',
    ]);
    expect(unlinkedLabels(snapshot, [], settings)).toEqual([]);
  });

  it('leaves out upstream’s own labels and its estimate storage', () => {
    const snapshot = snapshotWithLabels(['week', 'quick', 'waiting', 'est-30', 'est-2h']);
    expect(unlinkedLabels(snapshot, [], settings)).toEqual([]);
  });

  it('ignores a deleted label, and matches a customer whatever its case', () => {
    const snapshot = snapshotWithLabels(['gone', 'Avon']);
    snapshot.labels.l0 = { ...snapshot.labels.l0, is_deleted: true };
    expect(unlinkedLabels(snapshot, [customer('avon', 'avon')], settings)).toEqual([]);
  });

  it('comes back in alphabetical order', () => {
    const snapshot = snapshotWithLabels(['zephyr', 'acme', 'moonrise']);
    expect(unlinkedLabels(snapshot, [], settings)).toEqual(['acme', 'moonrise', 'zephyr']);
  });
});

describe('duplicateName', () => {
  const rows = [{ id: 'a', name: 'Alex' }, { id: 'b', name: 'Sam' }];

  it('refuses a name already taken, whatever its case or spacing', () => {
    expect(duplicateName(rows, 'Alex')).toBe(true);
    expect(duplicateName(rows, '  alex ')).toBe(true);
    expect(duplicateName(rows, 'Jo')).toBe(false);
  });

  /* Correcting a typo in a name must not clash with the name being corrected. */
  it('does not count a row as a duplicate of itself', () => {
    expect(duplicateName(rows, 'Alex', 'a')).toBe(false);
    expect(duplicateName(rows, 'Alex', 'b')).toBe(true);
  });

  it('says nothing about an empty name: that is a different complaint', () => {
    expect(duplicateName(rows, '   ')).toBe(false);
  });
});

describe('customerCounts', () => {
  it('counts the open tasks carrying each customer’s label', () => {
    const items = [
      item({ id: '1', labels: ['avon'] }),
      item({ id: '2', labels: ['avon'] }),
      item({ id: '3', labels: ['avon'], checked: true }),
      item({ id: '4', labels: ['aston-martin'] }),
    ];
    const counts = customerCounts(items, [customer('avon', 'avon'), customer('aston', 'aston-martin')]);
    expect(counts).toEqual({ avon: 2, aston: 1 });
  });

  it('counts nothing for a customer with no label yet', () => {
    expect(customerCounts([item({ labels: ['avon'] })], [customer('new', '')])).toEqual({ new: 0 });
  });
});

describe('goalGroups', () => {
  const areas: FocusArea[] = [
    { id: 'fw', name: 'Framework', short: 'Framework', label: 'focus-fw', color: 'grape', why: '' },
    { id: 'sc', name: 'Scaling', short: 'Scaling', label: 'focus-sc', color: 'blue', why: '' },
  ];
  const goal = (id: string, focus: string): Goal => ({ id, focus, title: id });

  it('puts every goal under its area, empty areas included', () => {
    const groups = goalGroups([goal('g1', 'fw')], areas);
    expect(groups.map((g) => g.focus?.id)).toEqual(['fw', 'sc']);
    expect(groups[0].goals.map((g) => g.id)).toEqual(['g1']);
    expect(groups[1].goals).toEqual([]);
  });

  /* A goal whose area was deleted still has to appear somewhere, or it
     vanishes from the page while staying in the document. */
  it('gathers goals whose focus area is gone into a group of their own, last', () => {
    const groups = goalGroups([goal('g1', 'fw'), goal('orphan', 'deleted')], areas);
    expect(groups).toHaveLength(3);
    expect(groups[2].focus).toBeNull();
    expect(groups[2].goals.map((g) => g.id)).toEqual(['orphan']);
  });

  it('adds no orphan group when there are none', () => {
    expect(goalGroups([goal('g1', 'fw')], areas)).toHaveLength(2);
  });
});

describe('targetDeadline', () => {
  it('resolves each choice from the date passed in', () => {
    expect(targetDeadline('2w', NOW)).toBe('2026-10-13');
    expect(targetDeadline('1m', NOW)).toBe('2026-10-29');
    expect(targetDeadline('eoy', NOW)).toBe('2026-12-31');
  });

  /* Null clears the deadline; undefined means do not touch it. Two different
     instructions, and sending the wrong one wipes a date nobody asked about. */
  it('tells clearing the date apart from leaving it alone', () => {
    expect(targetDeadline('none', NOW)).toBeNull();
    expect(targetDeadline('keep', NOW)).toBeUndefined();
  });
});

describe('goalLinkCounts', () => {
  it('counts the initiatives pointing at each goal', () => {
    const links = { t1: 'g1', t2: 'g1', t3: 'g2' };
    expect(goalLinkCounts(links, new Set(['t1', 't2', 't3']))).toEqual({ g1: 2, g2: 1 });
  });

  it('does not count a link whose task Todoist no longer has', () => {
    expect(goalLinkCounts({ t1: 'g1', gone: 'g1' }, new Set(['t1']))).toEqual({ g1: 1 });
  });
});
