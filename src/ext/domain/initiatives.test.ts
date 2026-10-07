import { describe, expect, it } from 'vitest';
import { item } from '@/test/items';
import { defaultSettings } from '@/ext/data/defaults';
import {
  initiativeProgress, initiativeWarnings, initiativesIn, isLive,
  labelsForInitiative, readInitiative,
} from './initiatives';

const NOW = new Date(2026, 8, 29);
const settings = defaultSettings();
const day = (y: number, m: number, d: number) => new Date(y, m - 1, d);

const initiative = (overrides: Parameters<typeof item>[0] = {}) =>
  item({ labels: ['initiative', 'focus-tsm-value', 'status-active'], ...overrides });

describe('readInitiative', () => {
  it('reads the focus, the status and the target off the task', () => {
    const task = initiative({ deadline: { date: '2026-10-31', lang: 'en' } });
    const read = readInitiative(task, settings);
    expect(read.focus).toBe('tsm-value');
    expect(read.status).toBe('active');
    expect(read.target?.getMonth()).toBe(9);
  });

  it('takes the first line of the description as the blocked reason', () => {
    const task = initiative({
      labels: ['initiative', 'status-blocked'],
      description: 'Waiting on CS Ops review\n\nMore detail below.',
    });
    expect(readInitiative(task, settings).blockedReason).toBe('Waiting on CS Ops review');
  });

  it('falls back to an idea when the task says nothing', () => {
    const read = readInitiative(item({ labels: ['initiative'] }), settings);
    expect(read).toEqual({ focus: null, status: 'idea', target: null, blockedReason: null });
  });

  /* Ticking a task off in Todoist is the same statement as setting the
     status here, so it must not still read as Active. */
  it('reads a completed task as done, whatever its label says', () => {
    expect(readInitiative(initiative({ checked: true }), settings).status).toBe('done');
  });

  it('ignores a status nobody recognises', () => {
    expect(readInitiative(item({ labels: ['initiative', 'status-wibble'] }), settings).status)
      .toBe('idea');
  });

  it('follows the configured prefixes', () => {
    const renamed = {
      ...settings,
      labels: { ...settings.labels, focusPrefix: 'area-', statusPrefix: 'state-' },
    };
    const task = item({ labels: ['initiative', 'area-growth', 'state-blocked'] });
    expect(readInitiative(task, renamed)).toMatchObject({ focus: 'growth', status: 'blocked' });
  });
});

describe('initiativeWarnings', () => {
  const read = (overrides: Parameters<typeof item>[0] = {}) =>
    readInitiative(initiative(overrides), settings);

  it('says nothing about a healthy initiative', () => {
    const open = [item({ id: 'c1', parent_id: 'i1' })];
    expect(initiativeWarnings(read(), open, NOW, day(2026, 9, 28))).toEqual([]);
  });

  it('gives the blocked reason, or just Blocked', () => {
    const withReason = read({
      labels: ['initiative', 'status-blocked'], description: 'Waiting on CS Ops review',
    });
    expect(initiativeWarnings(withReason, [item({ parent_id: 'i1' })], NOW))
      .toEqual([{ text: 'Waiting on CS Ops review', tone: 'red' }]);

    const bare = read({ labels: ['initiative', 'status-blocked'] });
    expect(initiativeWarnings(bare, [item({ parent_id: 'i1' })], NOW)[0].text).toBe('Blocked');
  });

  it('warns when something live has nothing open', () => {
    for (const status of ['status-active', 'status-planned']) {
      const live = read({ labels: ['initiative', status] });
      expect(initiativeWarnings(live, [], NOW)).toContainEqual({
        text: 'No next action', tone: 'red',
      });
    }
  });

  it('does not ask an idea or a finished initiative for a next action', () => {
    expect(initiativeWarnings(read({ labels: ['initiative', 'status-idea'] }), [], NOW))
      .toEqual([]);
    expect(initiativeWarnings(read({ labels: ['initiative', 'status-done'] }), [], NOW))
      .toEqual([]);
  });

  it('counts a completed sub-task as nothing open', () => {
    const done = [item({ id: 'c1', parent_id: 'i1', checked: true })];
    expect(initiativeWarnings(read(), done, NOW)[0].text).toBe('No next action');
  });

  it('says how long an Active initiative has been quiet, past a fortnight', () => {
    const open = [item({ id: 'c1', parent_id: 'i1' })];
    expect(initiativeWarnings(read(), open, NOW, day(2026, 9, 14)))
      .toEqual([{ text: 'Quiet for 15 days', tone: 'amber' }]);
    // Exactly a fortnight is not yet quiet.
    expect(initiativeWarnings(read(), open, NOW, day(2026, 9, 15))).toEqual([]);
  });

  it('does not call a Planned initiative quiet: it has not started', () => {
    const planned = read({ labels: ['initiative', 'status-planned'] });
    const open = [item({ id: 'c1', parent_id: 'i1' })];
    expect(initiativeWarnings(planned, open, NOW, day(2026, 1, 1))).toEqual([]);
  });

  /* An initiative with nothing open is already hearing the louder thing. */
  it('does not also call it quiet when it has no next action', () => {
    const warnings = initiativeWarnings(read(), [], NOW, day(2026, 1, 1));
    expect(warnings.map((w) => w.text)).toEqual(['No next action']);
  });

  /* Blocked is not live, so it is never asked for a next action: the
     blocker is the problem, and "No next action" would just be its symptom. */
  it('says only the blocker, even with nothing open', () => {
    const blocked = read({ labels: ['initiative', 'status-blocked'], description: 'Waiting' });
    expect(initiativeWarnings(blocked, [], NOW).map((w) => w.text)).toEqual(['Waiting']);
  });
});

describe('isLive and progress', () => {
  it('counts Active and Planned as live', () => {
    expect(isLive('active')).toBe(true);
    expect(isLive('planned')).toBe(true);
    for (const status of ['idea', 'blocked', 'done'] as const) expect(isLive(status)).toBe(false);
  });

  it('counts done over total', () => {
    const children = [item({ checked: true }), item({}), item({})];
    expect(initiativeProgress(children)).toEqual({ done: 1, total: 3 });
    expect(initiativeProgress([])).toEqual({ done: 0, total: 0 });
  });
});

describe('labelsForInitiative', () => {
  it('adds the marker and the labels a new initiative needs', () => {
    expect(labelsForInitiative([], settings, { focus: 'tsm-value', status: 'planned' }))
      .toEqual(['initiative', 'focus-tsm-value', 'status-planned']);
  });

  /* A status change must not strip the customer label off a task. */
  it('leaves labels it knows nothing about alone', () => {
    const existing = ['initiative', 'avon', 'week', 'status-idea'];
    expect(labelsForInitiative(existing, settings, { status: 'active' }))
      .toEqual(['initiative', 'avon', 'week', 'status-active']);
  });

  it('does not add the marker twice', () => {
    expect(labelsForInitiative(['initiative'], settings, {})).toEqual(['initiative']);
  });

  it('clears the focus when it is set to none', () => {
    expect(labelsForInitiative(['initiative', 'focus-x'], settings, { focus: null }))
      .toEqual(['initiative']);
  });
});

describe('initiativesIn', () => {
  it('takes the parent tasks carrying the marker', () => {
    const items = [
      initiative({ id: 'i1' }),
      item({ id: 'c1', parent_id: 'i1', labels: ['initiative'] }),
      item({ id: 'other', labels: ['objective'] }),
    ];
    expect(initiativesIn(items, settings).map((i) => i.id)).toEqual(['i1']);
  });
});
