import { describe, expect, it } from 'vitest';
import { due, item } from '@/test/items';
import { defaultSettings } from '@/ext/data/defaults';
import type { Customer } from '@/ext/data/types';
import {
  activeFilterCount, composerLabels, customerEmpty, customerTasks, daysUntil,
  engagementProgress, engagementVisible, engagementsOf, inPeriod, initialsOf,
  matchesFilters, shownCustomers, summarise, weekStartOf, NO_FILTERS,
} from './customers';

/** Tue 29 Sep 2026. This week runs Mon 28 Sep to Sun 4 Oct. */
const NOW = new Date(2026, 8, 29);
const settings = defaultSettings();

const AVON: Customer = {
  id: 'avon', name: 'Avon', label: 'avon',
  csm: null, stage: 'healthy', tier: 'P1', color: 'green',
};

const task = (overrides: Parameters<typeof item>[0] = {}) =>
  item({ labels: ['avon'], ...overrides });

const dated = (date: string, overrides: Parameters<typeof item>[0] = {}) =>
  task({ due: due(date), ...overrides });

describe('inPeriod', () => {
  it('All takes everything, dated or not', () => {
    expect(inPeriod(task(), 'all', NOW)).toBe(true);
    expect(inPeriod(dated('2027-01-01'), 'all', NOW)).toBe(true);
  });

  /* A task that was due last Tuesday is more today's problem than Tuesday's. */
  it('Today takes today and everything overdue', () => {
    expect(inPeriod(dated('2026-09-29'), 'today', NOW)).toBe(true);
    expect(inPeriod(dated('2026-09-22'), 'today', NOW)).toBe(true);
    expect(inPeriod(dated('2026-09-30'), 'today', NOW)).toBe(false);
    expect(inPeriod(task(), 'today', NOW)).toBe(false);
  });

  it('This week runs to Sunday 4 Oct, overdue included', () => {
    expect(inPeriod(dated('2026-09-28'), 'week', NOW)).toBe(true);
    expect(inPeriod(dated('2026-10-04'), 'week', NOW)).toBe(true);
    expect(inPeriod(dated('2026-10-05'), 'week', NOW)).toBe(false);
    expect(inPeriod(dated('2026-09-01'), 'week', NOW)).toBe(true);
  });

  /* The `week` label already means "no date, but this week" everywhere else
     in the app, and it has to mean the same here. */
  it('This week takes an undated task carrying the week label', () => {
    expect(inPeriod(task({ labels: ['avon', 'week'] }), 'week', NOW)).toBe(true);
    expect(inPeriod(task(), 'week', NOW)).toBe(false);
    // The label does not pull an undated task into Today.
    expect(inPeriod(task({ labels: ['avon', 'week'] }), 'today', NOW)).toBe(false);
  });

  it('follows a Sunday week start when asked for one', () => {
    // Sun 4 Oct is the start of the next week, so it falls outside.
    expect(inPeriod(dated('2026-10-04'), 'week', NOW, 'week', 0)).toBe(false);
    expect(inPeriod(dated('2026-10-03'), 'week', NOW, 'week', 0)).toBe(true);
  });

  it('reads a due date with a time of day as its day', () => {
    expect(inPeriod(dated('2026-09-29T18:30:00'), 'today', NOW)).toBe(true);
  });
});

describe('engagements', () => {
  const engagement = task({ id: 'e1', labels: ['avon', 'engagement'] });

  it('are the customer’s parent tasks carrying the marker', () => {
    const items = [engagement, task({ id: 't1' }), item({ id: 'x', labels: ['aston', 'engagement'] })];
    expect(engagementsOf(items, AVON, settings).map((e) => e.id)).toEqual(['e1']);
  });

  it('leave out one that is finished, or that is itself a sub-task', () => {
    const done = task({ id: 'e2', labels: ['avon', 'engagement'], checked: true });
    const child = task({ id: 'e3', labels: ['avon', 'engagement'], parent_id: 'e1' });
    expect(engagementsOf([done, child], AVON, settings)).toEqual([]);
  });
});

describe('customerTasks', () => {
  /* An engagement's sub-tasks live in its own card. Counting them here too
     would show every one of them twice. */
  it('leaves out the engagement and everything inside it', () => {
    const items = [
      task({ id: 'e1', labels: ['avon', 'engagement'] }),
      task({ id: 'inside', parent_id: 'e1', due: due('2026-09-29') }),
      dated('2026-09-29', { id: 'loose' }),
    ];
    expect(customerTasks(items, AVON, 'today', NOW, settings).map((t) => t.id))
      .toEqual(['loose']);
  });

  it('keeps a sub-task of something that is not an engagement', () => {
    const items = [
      task({ id: 'parent', due: due('2026-09-29') }),
      task({ id: 'child', parent_id: 'parent', due: due('2026-09-29') }),
    ];
    expect(customerTasks(items, AVON, 'today', NOW, settings).map((t) => t.id))
      .toEqual(['parent', 'child']);
  });

  it('only takes this customer’s tasks, and only open ones', () => {
    const items = [
      dated('2026-09-29', { id: 'mine' }),
      item({ id: 'theirs', labels: ['aston'], due: due('2026-09-29') }),
      dated('2026-09-29', { id: 'done', checked: true }),
    ];
    expect(customerTasks(items, AVON, 'today', NOW, settings).map((t) => t.id))
      .toEqual(['mine']);
  });
});

describe('engagementVisible', () => {
  const soonDays = 7;
  const eng = (deadline: string | null) =>
    task({ id: 'e1', labels: ['avon', 'engagement'], deadline: deadline ? { date: deadline, lang: 'en' } : null });

  it('shows nothing when engagements are switched off', () => {
    expect(engagementVisible(eng('2026-09-30'), 'all', false, NOW, soonDays)).toBe(false);
  });

  it('shows everything under All, dated or not', () => {
    expect(engagementVisible(eng(null), 'all', true, NOW, soonDays)).toBe(true);
  });

  it('Today shows only the ones within soonDays, or already past', () => {
    expect(engagementVisible(eng('2026-10-06'), 'today', true, NOW, soonDays)).toBe(true);
    expect(engagementVisible(eng('2026-10-07'), 'today', true, NOW, soonDays)).toBe(false);
    expect(engagementVisible(eng('2026-09-01'), 'today', true, NOW, soonDays)).toBe(true);
    expect(engagementVisible(eng(null), 'today', true, NOW, soonDays)).toBe(false);
  });

  /* An engagement being worked on this week belongs on the week's page
     whatever its own date says. */
  it('This week also shows one with a task in the week', () => {
    const far = eng('2027-01-01');
    expect(engagementVisible(far, 'week', true, NOW, soonDays)).toBe(false);
    const children = [task({ id: 'c', parent_id: 'e1', due: due('2026-10-01') })];
    expect(engagementVisible(far, 'week', true, NOW, soonDays, children)).toBe(true);
  });

  it('does not count a finished sub-task as work in the week', () => {
    const children = [task({ id: 'c', parent_id: 'e1', due: due('2026-10-01'), checked: true })];
    expect(engagementVisible(eng('2027-01-01'), 'week', true, NOW, soonDays, children)).toBe(false);
  });

  it('falls back to the due date when there is no deadline', () => {
    const byDue = task({ id: 'e1', labels: ['avon', 'engagement'], due: due('2026-09-30') });
    expect(daysUntil(byDue, NOW)).toBe(1);
    expect(engagementVisible(byDue, 'today', true, NOW, soonDays)).toBe(true);
  });
});

describe('customerEmpty and progress', () => {
  it('is empty with no tasks and no visible engagement', () => {
    expect(customerEmpty([], [])).toBe(true);
    expect(customerEmpty([task()], [])).toBe(false);
    expect(customerEmpty([], [task()])).toBe(false);
  });

  it('counts done over total, including what was ticked this session', () => {
    const children = [
      task({ id: 'a', checked: true }),
      task({ id: 'b' }),
      task({ id: 'c' }),
    ];
    expect(engagementProgress(children)).toEqual({ done: 1, total: 3 });
    expect(engagementProgress(children, new Set(['b']))).toEqual({ done: 2, total: 3 });
  });

  it('counts nothing as nothing rather than dividing by zero', () => {
    expect(engagementProgress([])).toEqual({ done: 0, total: 0 });
  });
});

describe('weekStartOf', () => {
  /* Todoist counts 1 = Monday .. 7 = Sunday; date-fns counts 0 = Sunday. The
     same conversion upstream's weekBounds makes, so the two cannot drift. */
  it('converts the Todoist setting the way upstream does', () => {
    expect(weekStartOf(1)).toBe(1);   // Monday
    expect(weekStartOf(7)).toBe(0);   // Sunday
    expect(weekStartOf(6)).toBe(6);   // Saturday
    expect(weekStartOf(undefined)).toBe(1);
  });

  it('makes the page agree with an account that starts weeks on Sunday', () => {
    // The week holding Tue 29 Sep then runs Sun 27 Sep to Sat 3 Oct.
    const start = weekStartOf(7);
    expect(inPeriod(dated('2026-10-03'), 'week', NOW, 'week', start)).toBe(true);
    expect(inPeriod(dated('2026-10-04'), 'week', NOW, 'week', start)).toBe(false);
  });
});

describe('matchesFilters', () => {
  const who = (over: Partial<Customer>): Customer => ({ ...AVON, ...over });

  it('lets everything through when nothing is chosen', () => {
    expect(matchesFilters(AVON, NO_FILTERS)).toBe(true);
    expect(activeFilterCount(NO_FILTERS)).toBe(0);
  });

  /* Two choices in one group are alternatives. */
  it('is OR inside a group', () => {
    const filters = { ...NO_FILTERS, csms: ['alex', 'sam'] };
    expect(matchesFilters(who({ csm: 'alex' }), filters)).toBe(true);
    expect(matchesFilters(who({ csm: 'sam' }), filters)).toBe(true);
    expect(matchesFilters(who({ csm: 'jo' }), filters)).toBe(false);
  });

  /* Choices in different groups narrow each other. */
  it('is AND across groups', () => {
    const filters = { csms: ['alex'], stages: [], tiers: ['P1'] };
    expect(matchesFilters(who({ csm: 'alex', tier: 'P1' }), filters)).toBe(true);
    expect(matchesFilters(who({ csm: 'alex', tier: 'P2' }), filters)).toBe(false);
    expect(matchesFilters(who({ csm: 'jo', tier: 'P1' }), filters)).toBe(false);
    expect(activeFilterCount(filters)).toBe(2);
  });

  it('never matches a customer with no CSM against a chosen one', () => {
    expect(matchesFilters(who({ csm: null }), { ...NO_FILTERS, csms: ['alex'] })).toBe(false);
  });
});

describe('shownCustomers', () => {
  const list: Customer[] = [
    { ...AVON, id: 'z', name: 'Zephyr', csm: 'alex' },
    { ...AVON, id: 'a', name: 'Acme', csm: 'sam' },
    { ...AVON, id: 'm', name: 'Moonrise', csm: 'alex' },
  ];

  it('sorts A to Z by default', () => {
    expect(shownCustomers(list, [], {}).map((c) => c.name))
      .toEqual(['Acme', 'Moonrise', 'Zephyr']);
  });

  it('follows the custom order when asked', () => {
    expect(shownCustomers(list, ['z', 'm', 'a'], { sort: 'custom' }).map((c) => c.id))
      .toEqual(['z', 'm', 'a']);
  });

  /* A sort that can lose a customer is worse than one in the wrong order. */
  it('still shows a customer the order has never heard of, after the rest', () => {
    expect(shownCustomers(list, ['z'], { sort: 'custom' }).map((c) => c.id))
      .toEqual(['z', 'a', 'm']);
  });

  it('drops the excluded ones and applies the filters', () => {
    expect(shownCustomers(list, [], { excluded: ['z'] }).map((c) => c.id)).toEqual(['a', 'm']);
    expect(shownCustomers(list, [], { filters: { ...NO_FILTERS, csms: ['alex'] } })
      .map((c) => c.id)).toEqual(['m', 'z']);
  });
});

describe('the header’s counts', () => {
  it('are taken from the cards the page draws', () => {
    const cards = [
      { customer: AVON, tasks: [task(), task()], engagements: [task()] },
      { customer: AVON, tasks: [task()], engagements: [] },
    ];
    expect(summarise(cards)).toEqual({ tasks: 3, engagements: 1, customers: 2 });
    expect(summarise([])).toEqual({ tasks: 0, engagements: 0, customers: 0 });
  });
});

describe('composerLabels and initials', () => {
  it('says what a new task or engagement will carry', () => {
    expect(composerLabels('task', AVON, settings)).toEqual(['avon']);
    expect(composerLabels('engagement', AVON, settings)).toEqual(['avon', 'engagement']);
  });

  it('leaves out a label a customer has not got yet', () => {
    expect(composerLabels('task', { ...AVON, label: '' }, settings)).toEqual([]);
  });

  it('takes initials from the first and last word', () => {
    expect(initialsOf('Aston Martin')).toBe('AM');
    expect(initialsOf('LVMH Beauty Tech')).toBe('LT');
    expect(initialsOf('Avon')).toBe('AV');
    expect(initialsOf('  ')).toBe('?');
  });
});
