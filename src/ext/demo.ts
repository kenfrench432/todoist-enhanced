import {
  addDays, addMonths, format, startOfDay, startOfISOWeek, subDays, subWeeks,
} from 'date-fns';
import type { CompletedItem, Item, Snapshot } from '@/domain/types';
import { useStore } from '@/store/store';
import { useExt } from './data/store';
import { defaultExtData } from './data/defaults';
import type { ExtData } from './data/types';
import { dueForPeriod } from './domain/objectives';

/**
 * The sample account the demo shows.
 *
 * Built to exercise the rules rather than to be a catalogue: an engagement on
 * each side of `soonDays`, an initiative of every shape a warning can describe,
 * a KPI where lower is better, objectives at all four cadences. If a rule has a
 * boundary, something here sits on it.
 *
 * Dates come from "today" at build time, the same way `buildDemoSnapshot`
 * works, so the demo is current whenever it is opened.
 */

const iso = (date: Date) => format(date, 'yyyy-MM-dd');

interface Builder {
  items: Record<string, Item>;
  add: (partial: Partial<Item> & { content: string }) => Item;
}

function builder(today: Date): Builder {
  const items: Record<string, Item> = {};
  let counter = 0;
  const add = (partial: Partial<Item> & { content: string }): Item => {
    counter += 1;
    const item: Item = {
      id: `ext-demo-${counter}`,
      user_id: 'demo-user',
      project_id: 'inbox',
      section_id: null,
      parent_id: null,
      description: '',
      priority: 1,
      due: null,
      deadline: null,
      duration: null,
      labels: [],
      child_order: counter,
      day_order: -1,
      collapsed: false,
      checked: false,
      is_deleted: false,
      added_at: subDays(today, 20).toISOString(),
      completed_at: null,
      updated_at: today.toISOString(),
      responsible_uid: null,
      ...partial,
    } as Item;
    items[item.id] = item;
    return item;
  };
  return { items, add };
}

const due = (date: Date) =>
  ({ date: iso(date), timezone: null, string: iso(date), lang: 'en', is_recurring: false });
const deadline = (date: Date) => ({ date: iso(date), lang: 'en' });
/** An objective's due date arrives already formatted, from `dueForPeriod`. */
const onDay = (date: string) =>
  ({ date, timezone: null, string: date, lang: 'en', is_recurring: false });

/** The customers, CSMs, stages, goals and links the demo starts with. */
export function demoExtData(today: Date): ExtData {
  const data = defaultExtData(Date.now());

  data.csms = [
    { id: 'alex', name: 'Alex Moreau' },
    { id: 'sam', name: 'Sam Okafor' },
    { id: 'jo', name: 'Jo Lindqvist' },
  ];

  data.customers = [
    { id: 'aston', name: 'Aston Martin', label: 'aston-martin', csm: 'alex', stage: 'healthy', tier: 'P1', color: 'green' },
    { id: 'avon', name: 'Avon', label: 'avon', csm: 'sam', stage: 'attention', tier: 'P1', color: 'red' },
    { id: 'lvmh', name: 'LVMH Beauty Tech', label: 'lvmh-beauty-tech', csm: 'alex', stage: 'healthy', tier: 'P1', color: 'grape' },
    { id: 'northwind', name: 'Northwind Foods', label: 'northwind-foods', csm: 'jo', stage: 'onboarding', tier: 'P2', color: 'orange' },
    { id: 'contoso', name: 'Contoso Group', label: 'contoso-group', csm: 'sam', stage: 'risk', tier: 'P2', color: 'blue' },
    { id: 'tailspin', name: 'Tailspin Travel', label: 'tailspin-travel', csm: 'jo', stage: 'healthy', tier: 'P3', color: 'teal' },
  ];
  data.customerOrder = ['avon', 'aston', 'lvmh', 'contoso', 'northwind', 'tailspin'];

  data.goals = [
    { id: 'g-roadmaps', focus: 'fw', title: 'Every P1 on a maturity roadmap' },
    { id: 'g-partners', focus: 'fw', title: 'Partners run their own assessments' },
    { id: 'g-ttfv', focus: 'sc', title: 'Cut time to first value' },
    { id: 'g-value', focus: 'va', title: 'Every QBR opens with a number' },
  ];

  /* One reached, one at risk, one where lower is better, and one with enough
     history behind it to show a real month-on-month delta. */
  data.kpis = [
    {
      id: 'k-roadmaps', goal: 'g-roadmaps', name: 'P1s with a roadmap', unit: '',
      start: 0, target: 12,
      history: [
        { at: iso(subDays(today, 150)), value: 2 },
        { at: iso(subDays(today, 60)), value: 6 },
        { at: iso(subDays(today, 5)), value: 9 },
      ],
    },
    {
      id: 'k-partners', goal: 'g-partners', name: 'Partner-led assessments', unit: '',
      start: 0, target: 4,
      history: [{ at: iso(subDays(today, 40)), value: 3 }, { at: iso(subDays(today, 2)), value: 4 }],
    },
    {
      id: 'k-ttfv', goal: 'g-ttfv', name: 'Days to first value', unit: 'd',
      start: 45, target: 20,
      history: [
        { at: iso(subDays(today, 120)), value: 45 },
        { at: iso(subDays(today, 45)), value: 38 },
        { at: iso(subDays(today, 3)), value: 31 },
      ],
    },
    {
      id: 'k-qbr', goal: 'g-value', name: 'QBRs opening with a metric', unit: '%',
      start: 10, target: 90,
      history: [
        { at: iso(subDays(today, 90)), value: 25 },
        { at: iso(subDays(today, 35)), value: 40 },
        { at: iso(subDays(today, 1)), value: 48 },
      ],
    },
  ];

  /* Ken's own two rules, aimed at the demo's projects: a customer project
     where the label is missing, and an engagement sitting in the Inbox. Four
     things to tidy, and nothing tidied until the button is pressed. */
  data.rules = [
    {
      id: 'r-label', on: true,
      when: { projectId: 'client-a', hasLabel: null },
      then: { addLabel: 'engagement', moveToProjectId: null },
    },
    {
      id: 'r-move', on: true,
      when: { projectId: 'inbox', hasLabel: 'engagement' },
      then: { addLabel: null, moveToProjectId: 'client-a' },
    },
  ];

  data.notes = {};
  return data;
}

/** The tasks the demo's pages read: customer work, initiatives, objectives. */
export function demoExtSnapshot(today: Date): {
  items: Record<string, Item>;
  links: Pick<ExtData, 'initiativeGoals' | 'objectiveParents' | 'objectiveGoals'>;
} {
  const { items, add } = builder(today);
  const links = {
    initiativeGoals: {} as Record<string, string>,
    objectiveParents: {} as Record<string, string>,
    objectiveGoals: {} as Record<string, string>,
  };

  /* ---- Customers ---- */

  // An engagement inside soonDays, so Today shows it.
  const soon = add({
    content: 'Q4 platform rollout',
    labels: ['avon', 'engagement'],
    deadline: deadline(addDays(today, 3)),
  });
  add({ content: 'Agree the cut-over date', parent_id: soon.id, labels: ['avon'], due: due(today) });
  add({ content: 'Brief the integration partner', parent_id: soon.id, labels: ['avon'], due: due(addDays(today, 2)) });
  add({
    content: 'Confirm the sandbox credentials', parent_id: soon.id, labels: ['avon'],
    checked: true, completed_at: subDays(today, 1).toISOString(),
  });

  /* Far past soonDays, so Today hides it — but it has a task this week, which
     is what puts it on This week. */
  const later = add({
    content: 'Brand portal consolidation',
    labels: ['aston-martin', 'engagement'],
    deadline: deadline(addMonths(today, 1)),
  });
  add({ content: 'Map the legacy taxonomy', parent_id: later.id, labels: ['aston-martin'], due: due(addDays(today, 2)) });
  add({ content: 'Scope the migration window', parent_id: later.id, labels: ['aston-martin'] });

  // Loose customer tasks: today, this week, later, and one undated for `week`.
  add({ content: 'Send the quarterly value review', labels: ['avon'], due: due(today), priority: 3 });
  add({ content: 'Chase the open support ticket', labels: ['avon'], due: due(subDays(today, 2)), priority: 4 });
  add({ content: 'Draft the maturity assessment', labels: ['aston-martin'], due: due(addDays(today, 1)) });
  /* Demo copy is part of the test surface. Playwright matches an accessible
     name by substring, so a task called "…dashboard" or "onboarding" answers
     to upstream's `getByRole('button', { name: 'Board' })` and hijacks its
     Upcoming journey. Neither word appears in a task title here. */
  add({ content: 'Share the adoption figures', labels: ['lvmh-beauty-tech'], due: due(today) });
  add({ content: 'Prep the renewal story', labels: ['lvmh-beauty-tech'], due: due(addDays(today, 3)) });
  add({ content: 'Book the kick-off workshop', labels: ['northwind-foods'], due: due(addDays(today, 4)) });
  add({ content: 'Write the recovery plan', labels: ['contoso-group'], due: due(today), priority: 4 });
  add({ content: 'Agree the escalation path', labels: ['contoso-group'], due: due(addDays(today, 9)) });
  add({ content: 'Review the integration backlog', labels: ['tailspin-travel', 'week'] });

  /* ---- Initiatives: one of every shape a warning can describe ---- */

  const healthy = add({
    content: 'Assessment to roadmap pipeline',
    labels: ['initiative', 'focus-maturity-framework', 'status-active'],
    deadline: deadline(addMonths(today, 2)),
  });
  add({ content: 'Draft the scoring rubric', parent_id: healthy.id, labels: ['initiative', 'focus-maturity-framework', 'status-active'], due: due(addDays(today, 2)) });
  add({
    content: 'Agree the rubric with Product', parent_id: healthy.id,
    labels: ['initiative', 'focus-maturity-framework', 'status-active'],
    checked: true, completed_at: subDays(today, 2).toISOString(),
  });
  links.initiativeGoals[healthy.id] = 'g-roadmaps';

  const blocked = add({
    content: 'Success plan templates',
    labels: ['initiative', 'focus-scaling-bob', 'status-blocked'],
    description: 'Waiting on CS Ops to sign off the data fields',
    deadline: deadline(addDays(today, 20)),
  });
  add({ content: 'Collect the five best plans', parent_id: blocked.id, labels: ['initiative', 'focus-scaling-bob', 'status-blocked'] });
  links.initiativeGoals[blocked.id] = 'g-ttfv';

  // Live with nothing open at all: "No next action".
  const stalled = add({
    content: 'Tiered engagement motion',
    labels: ['initiative', 'focus-scaling-bob', 'status-active'],
  });
  links.initiativeGoals[stalled.id] = 'g-ttfv';

  // Active, something open, but the last thing finished was a fortnight ago.
  const quiet = add({
    content: 'Adoption-lift measurement method',
    labels: ['initiative', 'focus-tsm-value', 'status-active'],
  });
  add({ content: 'Pick the three metrics', parent_id: quiet.id, labels: ['initiative', 'focus-tsm-value', 'status-active'] });
  add({
    content: 'Pull the baseline numbers', parent_id: quiet.id,
    labels: ['initiative', 'focus-tsm-value', 'status-active'],
    checked: true, completed_at: subDays(today, 19).toISOString(),
  });
  links.initiativeGoals[quiet.id] = 'g-value';

  add({
    content: 'Partner enablement kit',
    labels: ['initiative', 'focus-maturity-framework', 'status-idea'],
  });

  /* ---- Objectives, at all four cadences ---- */

  const quarter = add({
    content: 'Every P1 has a roadmap they agreed to',
    labels: ['objective', 'period-quarter', 'focus-maturity-framework'],
    due: onDay(dueForPeriod('q', 0, today)),
  });
  links.objectiveGoals[quarter.id] = 'g-roadmaps';

  const month = add({
    content: 'Three roadmaps agreed this month',
    labels: ['objective', 'period-month', 'focus-maturity-framework'],
    due: onDay(dueForPeriod('m', 0, today)),
  });
  links.objectiveParents[month.id] = quarter.id;

  const week = add({
    content: 'Agree the scoring rubric with Product',
    labels: ['objective', 'period-week', 'focus-maturity-framework'],
    due: onDay(dueForPeriod('w', 0, today)),
  });
  links.objectiveParents[week.id] = month.id;

  const week2 = add({
    content: 'Draft the tiered motion one-pager',
    labels: ['objective', 'period-week', 'focus-scaling-bob'],
    due: onDay(dueForPeriod('w', 0, today)),
  });
  links.objectiveParents[week2.id] = month.id;

  add({
    content: 'Clear the Avon support backlog',
    labels: ['objective', 'period-week'],
    due: onDay(dueForPeriod('w', 0, today)),
    checked: true, completed_at: subDays(today, 1).toISOString(),
  });

  const day = add({
    content: 'Send the rubric to Product',
    labels: ['objective', 'period-day', 'focus-maturity-framework'],
    due: onDay(dueForPeriod('d', 0, today)),
  });
  links.objectiveParents[day.id] = week.id;
  add({
    content: 'Reply to the Contoso escalation',
    labels: ['objective', 'period-day'],
    due: onDay(dueForPeriod('d', 0, today)),
  });

  return { items, links };
}

/**
 * Completed work carrying the focus labels, for the momentum cards.
 *
 * Substituted for `buildDemoCompleted` on the pages that read completed items,
 * because that builder is called inside `useCompleted` and carries none of the
 * fork's labels — so momentum would read Stalling everywhere. Shaped so the
 * three focus areas read differently: rising, steady, and slowing.
 */
export function demoCompleted(today: Date): CompletedItem[] {
  const weekly: Record<string, number[]> = {
    'focus-maturity-framework': [1, 2, 1, 2, 3, 3, 4, 3],
    'focus-tsm-value': [2, 2, 2, 2, 2, 2, 2, 1],
    'focus-scaling-bob': [3, 3, 2, 2, 1, 1, 0, 1],
  };

  const rows: CompletedItem[] = [];
  let counter = 0;
  for (const [label, counts] of Object.entries(weekly)) {
    counts.forEach((count, index) => {
      const weekStart = startOfISOWeek(subWeeks(startOfDay(today), counts.length - 1 - index));
      for (let n = 0; n < count; n += 1) {
        counter += 1;
        rows.push({
          id: `ext-done-${counter}`,
          user_id: 'demo-user',
          project_id: 'inbox',
          section_id: null,
          content: 'A completed action',
          completed_at: addDays(weekStart, 1 + (n % 4)).toISOString(),
          labels: ['initiative', label],
        });
      }
    });
  }
  return rows;
}

/** Merges the sample tasks into a snapshot, leaving upstream's demo intact. */
export function withExtDemo(snapshot: Snapshot, today: Date): {
  snapshot: Snapshot;
  data: ExtData;
} {
  const { items, links } = demoExtSnapshot(today);
  const data = { ...demoExtData(today), ...links };
  return {
    snapshot: { ...snapshot, items: { ...snapshot.items, ...items } },
    data,
  };
}

let seeded = false;

/**
 * Puts the sample data in front of the demo.
 *
 * A wrap rather than an edit: BUILD-PLAN allows one line in upstream's demo
 * start "if buildDemoSnapshot cannot be wrapped from outside", and it can be.
 * Both `startDemo` and the resume in `init` set `demo` in one go, so watching
 * the store catches either.
 *
 * It also seeds on load when the demo is already running, because this module
 * arrives with the first ext page — which may be long after the demo started.
 */
export function installExtDemo(): void {
  const seed = () => {
    if (seeded) return;
    const state = useStore.getState();
    if (!state.demo) return;
    seeded = true;
    const today = startOfDay(new Date());
    const { snapshot, data } = withExtDemo(state.snapshot, today);
    useStore.setState({ snapshot });
    /* setState, not update(): the demo's document is a fixture, not an edit,
       and update() would stamp it and try to write. */
    useExt.setState({ data, loaded: true });
  };

  seed();
  useStore.subscribe((state, previous) => {
    if (state.demo && !previous.demo) seed();
    // Leaving the demo lets the next one start fresh.
    if (!state.demo && previous.demo) seeded = false;
  });
}
