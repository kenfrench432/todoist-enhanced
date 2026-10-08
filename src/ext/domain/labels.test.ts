import { describe, expect, it } from 'vitest';
import { item } from '@/test/items';
import { defaultSettings } from '@/ext/data/defaults';
import type { Customer } from '@/ext/data/types';
import { emptySnapshot, type Label, type Snapshot } from '@/domain/types';
import type { FocusArea } from '@/ext/data/types';
import {
  customerLabelChoices, customerLabelOf, customerLabelsOf, focusLabelChoices,
  isMarkerLabel, ruleLabelChoices, slug, swapPrefixedLabel,
} from './labels';

const settings = defaultSettings();

const customer = (id: string, label: string): Customer =>
  ({ id, name: id, label, csm: null, stage: 'healthy', tier: 'P2', color: 'green' });

const CUSTOMERS = [customer('aston', 'aston-martin'), customer('avon', 'avon')];

describe('slug', () => {
  it('makes a label out of a customer name', () => {
    expect(slug('Aston Martin')).toBe('aston-martin');
    expect(slug('LVMH Beauty Tech')).toBe('lvmh-beauty-tech');
    expect(slug('  Northwind  Foods ')).toBe('northwind-foods');
  });

  it('folds accents rather than dropping the letter', () => {
    expect(slug('Nestlé')).toBe('nestle');
    expect(slug('Peña & Co.')).toBe('pena-co');
  });

  it('gives nothing back for a name with nothing in it', () => {
    expect(slug('   ')).toBe('');
    expect(slug('!!!')).toBe('');
  });
});

describe('isMarkerLabel', () => {
  it('knows the fork’s own labels', () => {
    for (const label of ['engagement', 'initiative', 'objective']) {
      expect(isMarkerLabel(label, settings)).toBe(true);
    }
    for (const label of ['period-week', 'focus-tsm-value', 'status-active']) {
      expect(isMarkerLabel(label, settings)).toBe(true);
    }
  });

  /* Manage lists the labels that are not accounted for, so a customer label
     or one of upstream's must not be mistaken for a marker. */
  it('leaves customer and upstream labels alone', () => {
    for (const label of ['aston-martin', 'week', 'quick', 'waiting', 'est-30']) {
      expect(isMarkerLabel(label, settings)).toBe(false);
    }
  });

  it('matches whatever case the label is written in', () => {
    expect(isMarkerLabel('Engagement', settings)).toBe(true);
    expect(isMarkerLabel('Focus-Maturity', settings)).toBe(true);
  });

  it('follows the marker names when they are configured away', () => {
    const renamed = { ...settings, labels: { ...settings.labels, engagement: 'key-initiative' } };
    expect(isMarkerLabel('key-initiative', renamed)).toBe(true);
    expect(isMarkerLabel('engagement', renamed)).toBe(false);
  });
});

describe('the customer a task belongs to', () => {
  it('finds the one customer label', () => {
    const task = item({ labels: ['aston-martin', 'week'] });
    expect(customerLabelOf(task, CUSTOMERS)).toBe('aston-martin');
  });

  it('finds none when the task carries none', () => {
    expect(customerLabelOf(item({ labels: ['week'] }), CUSTOMERS)).toBeNull();
  });

  /* Two customers claiming one task is shown under both with a warning, not
     resolved by quietly picking one. */
  it('returns both when two customers claim the task', () => {
    const task = item({ labels: ['aston-martin', 'avon'] });
    expect(customerLabelsOf(task, CUSTOMERS)).toEqual(['aston-martin', 'avon']);
    expect(customerLabelOf(task, CUSTOMERS)).toBeNull();
  });

  it('ignores a customer registered without a label', () => {
    const unlabelled = [{ ...customer('new', ''), label: '' }];
    expect(customerLabelsOf(item({ labels: ['week'] }), unlabelled)).toEqual([]);
  });
});

describe('swapPrefixedLabel', () => {
  it('replaces the one label with that prefix and leaves the rest', () => {
    const labels = ['initiative', 'focus-tsm-value', 'status-planned', 'week'];
    expect(swapPrefixedLabel(labels, 'status-', 'active'))
      .toEqual(['initiative', 'focus-tsm-value', 'week', 'status-active']);
  });

  it('takes a whole label as happily as a bare value', () => {
    expect(swapPrefixedLabel(['status-idea'], 'status-', 'status-done'))
      .toEqual(['status-done']);
  });

  it('removes the label when there is no new value', () => {
    expect(swapPrefixedLabel(['initiative', 'focus-x'], 'focus-', null))
      .toEqual(['initiative']);
  });

  it('adds the label when the task had none', () => {
    expect(swapPrefixedLabel(['initiative'], 'status-', 'active'))
      .toEqual(['initiative', 'status-active']);
  });

  /* A task that somehow carried two statuses comes out with one. */
  it('leaves exactly one label with the prefix', () => {
    const messy = ['status-idea', 'status-active', 'status-blocked'];
    expect(swapPrefixedLabel(messy, 'status-', 'done')).toEqual(['status-done']);
  });

  it('does not add a label the task already has', () => {
    expect(swapPrefixedLabel(['status-active'], 'status-', 'active'))
      .toEqual(['status-active']);
  });

  it('keeps the order of the labels that stay', () => {
    expect(swapPrefixedLabel(['a', 'status-x', 'b', 'c'], 'status-', 'y'))
      .toEqual(['a', 'b', 'c', 'status-y']);
  });
});

function snapshotWith(names: string[]): Snapshot {
  const snapshot = emptySnapshot();
  names.forEach((name, index) => {
    snapshot.labels[`l${index}`] =
      { id: `l${index}`, name, color: 'charcoal', is_deleted: false } as Label;
  });
  return snapshot;
}

const area = (id: string, label: string): FocusArea =>
  ({ id, name: id, short: id, label, color: 'blue', why: '' });

describe('customerLabelChoices', () => {
  const snapshot = snapshotWith(['avon', 'aston-martin', 'engagement', 'focus-x', 'est-30']);

  /* A customer whose label was `engagement` would claim every engagement in
     the account. */
  it('offers real labels and never a marker', () => {
    expect(customerLabelChoices(snapshot, settings, CUSTOMERS, 'avon').map((c) => c.name))
      .toEqual(['avon']);
  });

  it('leaves out a label another customer already means', () => {
    const choices = customerLabelChoices(snapshot, settings, CUSTOMERS, 'aston');
    expect(choices.map((c) => c.name)).toEqual(['aston-martin']);
    expect(choices.map((c) => c.name)).not.toContain('avon');
  });

  /* A picker that silently dropped the current value would read as having
     lost the setting. */
  it('always offers what is already chosen, flagged when Todoist lacks it', () => {
    const orphan = [customer('new', 'never-created')];
    const choices = customerLabelChoices(snapshot, settings, orphan, 'new');
    expect(choices[0]).toEqual({ name: 'never-created', missing: true });
    expect(choices.some((c) => c.name === 'avon' && !c.missing)).toBe(true);
  });
});

describe('focusLabelChoices', () => {
  const snapshot = snapshotWith(['focus-one', 'focus-two', 'avon', 'engagement']);
  const areas = [area('a', 'focus-one'), area('b', 'focus-two')];

  it('offers only labels carrying the focus prefix', () => {
    expect(focusLabelChoices(snapshot, settings, [area('a', 'focus-one')], 'a')
      .map((c) => c.name)).toEqual(['focus-one', 'focus-two']);
  });

  it('leaves out one another area already means', () => {
    expect(focusLabelChoices(snapshot, settings, areas, 'a').map((c) => c.name))
      .toEqual(['focus-one']);
  });

  /* The shipped defaults point at labels a fresh account has never had. */
  it('offers a default’s label even though Todoist has not got it', () => {
    const fresh = [area('fw', 'focus-maturity-framework')];
    const choices = focusLabelChoices(snapshot, settings, fresh, 'fw');
    expect(choices[0]).toEqual({ name: 'focus-maturity-framework', missing: true });
  });
});

describe('ruleLabelChoices', () => {
  const snapshot = snapshotWith(['waiting', 'est-45']);

  it('offers Todoist labels, alphabetically, without the estimates', () => {
    expect(ruleLabelChoices(snapshot, [])).toEqual(['waiting']);
  });

  /* The fork's own labels can be on tasks before the account has them — a
     fresh document points its focus areas at labels Todoist has never had —
     and a rule has to be able to name one. */
  it('offers a label seen on a task that Todoist has no record of', () => {
    expect(ruleLabelChoices(snapshot, [item({ labels: ['engagement', 'avon'] })]))
      .toEqual(['avon', 'engagement', 'waiting']);
  });

  it('offers each label once, keeping the first spelling it saw', () => {
    const items = [item({ labels: ['Waiting'] }), item({ labels: ['engagement', 'engagement'] })];
    expect(ruleLabelChoices(snapshot, items)).toEqual(['engagement', 'waiting']);
  });

  it('leaves an estimate out wherever it comes from', () => {
    expect(ruleLabelChoices(snapshot, [item({ labels: ['est-90'] })])).toEqual(['waiting']);
  });
});
