import { describe, expect, it } from 'vitest';
import { item } from '@/test/items';
import { defaultSettings } from '@/ext/data/defaults';
import type { Customer } from '@/ext/data/types';
import { customerLabelOf, customerLabelsOf, isMarkerLabel, slug, swapPrefixedLabel } from './labels';

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
