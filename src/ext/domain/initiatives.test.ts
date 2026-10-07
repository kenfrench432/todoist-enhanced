import { describe, expect, it } from 'vitest';
import { item } from '@/test/items';
import { defaultSettings } from '@/ext/data/defaults';
import type { CompletedItem } from '@/domain/types';
import {
  completedInitiatives, groupInitiatives, initiativeProgress, initiativeSummary,
  initiativeWarnings, initiativesIn, isLive, labelsForInitiative, lastDoneAt,
  readInitiative,
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

describe('lastDoneAt', () => {
  const done = (id: string, at: string | null) =>
    item({ id, checked: true, completed_at: at });

  it('takes the most recent completion, in any order', () => {
    const children = [
      done('a', '2026-09-10T09:00:00Z'),
      done('b', '2026-09-28T09:00:00Z'),
      done('c', '2026-09-20T09:00:00Z'),
    ];
    expect(lastDoneAt(children)?.toISOString()).toBe('2026-09-28T09:00:00.000Z');
  });

  it('ignores open tasks and unreadable dates', () => {
    expect(lastDoneAt([item({ id: 'open' })])).toBeNull();
    expect(lastDoneAt([done('a', null)])).toBeNull();
    expect(lastDoneAt([done('a', 'not a date')])).toBeNull();
  });

  /* A sub-task completed long enough ago to have left the snapshot gives
     null, and the warning then says nothing rather than guessing. */
  it('is null with nothing completed, so no warning is invented', () => {
    expect(lastDoneAt([])).toBeNull();
    const read = readInitiative(initiative(), settings);
    expect(initiativeWarnings(read, [item({ id: 'c' })], NOW, lastDoneAt([]))).toEqual([]);
  });
});

describe('groupInitiatives', () => {
  const areas = [
    { id: 'va', name: 'Value', label: 'focus-tsm-value', color: 'teal' },
    { id: 'sc', name: 'Scaling', label: 'focus-scaling-bob', color: 'blue' },
  ];
  const tasks = [
    initiative({ id: 'i1', labels: ['initiative', 'focus-tsm-value', 'status-active'] }),
    initiative({ id: 'i2', labels: ['initiative', 'focus-tsm-value', 'status-blocked'] }),
    initiative({ id: 'i3', labels: ['initiative', 'focus-gone', 'status-idea'] }),
  ];

  it('puts each under its focus area, empty areas included', () => {
    const groups = groupInitiatives(tasks, 'focus', areas, settings);
    expect(groups.map((g) => g.key)).toEqual(['va', 'sc', 'none']);
    expect(groups[0].tasks.map((t) => t.id)).toEqual(['i1', 'i2']);
    expect(groups[1].tasks).toEqual([]);
  });

  /* An initiative whose area was deleted still has to be reachable. */
  it('gathers the unfiled ones at the end', () => {
    const groups = groupInitiatives(tasks, 'focus', areas, settings);
    expect(groups[2].tasks.map((t) => t.id)).toEqual(['i3']);
  });

  it('adds no catch-all group when every one is filed', () => {
    expect(groupInitiatives(tasks.slice(0, 2), 'focus', areas, settings).map((g) => g.key))
      .toEqual(['va', 'sc']);
  });

  it('groups by status in the order they matter, skipping empty ones', () => {
    const groups = groupInitiatives(tasks, 'status', areas, settings);
    expect(groups.map((g) => g.title)).toEqual(['Active', 'Blocked', 'Idea']);
  });
});

describe('completedInitiatives', () => {
  const row = (id: string, at: string, labels: string[]): CompletedItem => ({
    id, user_id: 'u', project_id: 'p', section_id: null,
    content: id, completed_at: at, labels,
  });

  it('keeps the ones carrying the marker, newest first', () => {
    const rows = [
      row('old', '2026-01-01T00:00:00Z', ['initiative']),
      row('a-subtask', '2026-09-01T00:00:00Z', ['focus-tsm-value']),
      row('new', '2026-09-28T00:00:00Z', ['initiative', 'focus-tsm-value']),
    ];
    expect(completedInitiatives(rows, settings).map((r) => r.id)).toEqual(['new', 'old']);
  });

  it('copes with a row that has no labels at all', () => {
    const bare = { ...row('x', '2026-09-01T00:00:00Z', []), labels: undefined };
    expect(completedInitiatives([bare], settings)).toEqual([]);
  });
});

describe('initiativeSummary', () => {
  const read = (labels: string[]) => readInitiative(item({ labels }), settings);

  it('counts active, blocked and the ones with nothing open', () => {
    const entries = [
      { initiative: read(['initiative', 'status-active']), children: [item({ id: 'c' })] },
      { initiative: read(['initiative', 'status-active']), children: [] },
      { initiative: read(['initiative', 'status-blocked']), children: [item({ id: 'd' })] },
      { initiative: read(['initiative', 'status-planned']), children: [item({ id: 'e', checked: true })] },
      { initiative: read(['initiative', 'status-idea']), children: [] },
    ];
    // Two active; one blocked; the second active and the planned one have
    // nothing open, the idea is not live so it does not count.
    expect(initiativeSummary(entries)).toEqual({ active: 2, blocked: 1, noNextAction: 2 });
  });

  it('counts nothing from nothing', () => {
    expect(initiativeSummary([])).toEqual({ active: 0, blocked: 0, noNextAction: 0 });
  });
});
