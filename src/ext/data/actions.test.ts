import { describe, expect, it } from 'vitest';
import {
  addCsm, addCustomer, addFocusArea, addGoal, addKpi, addStage, cycleTone,
  linkInitiativeGoal, linkObjective, linkObjectiveGoal, logKpiValue, moveStage,
  pruneLinks, removeCsm, removeCustomer, removeFocusArea, removeGoal, removeKpi,
  removeStage, renameCustomer, renameCustomerLabel, renameStage, setCustomer,
  remapTaskIds, setCustomerOrder, setNote, setSettings,
} from './actions';
import { slug } from '@/ext/domain/labels';
import { defaultExtData } from './defaults';
import type { ExtData } from './types';

const base = (): ExtData => defaultExtData(0);

/** The id of the customer added last. */
const lastCustomer = (data: ExtData) => data.customers[data.customers.length - 1].id;

describe('slug', () => {
  it('makes the customer label from the name', () => {
    expect(slug('Aston Martin')).toBe('aston-martin');
    expect(slug('LVMH Beauty Tech')).toBe('lvmh-beauty-tech');
    expect(slug('  Northwind  Foods  ')).toBe('northwind-foods');
    expect(slug('Nestlé & Co.')).toBe('nestle-co');
  });
});

describe('customers', () => {
  it('adds one at the first stage, in the order', () => {
    const data = addCustomer(base(), 'Aston Martin');
    const customer = data.customers[0];
    expect(customer.label).toBe('aston-martin');
    expect(customer.stage).toBe('onboarding');
    expect(customer.tier).toBe('P3');
    expect(data.customerOrder).toEqual([customer.id]);
  });

  /* The label is on every one of that customer's tasks in Todoist. Renaming
     the customer here must never touch it. */
  it('renaming a customer leaves its label alone', () => {
    let data = addCustomer(base(), 'Aston Martin');
    const id = lastCustomer(data);
    data = renameCustomer(data, id, 'Aston Martin Lagonda');
    expect(data.customers[0].name).toBe('Aston Martin Lagonda');
    expect(data.customers[0].label).toBe('aston-martin');
  });

  it('renames the label only when asked for that explicitly', () => {
    let data = addCustomer(base(), 'Aston Martin');
    data = renameCustomerLabel(data, lastCustomer(data), 'aston');
    expect(data.customers[0].label).toBe('aston');
    expect(data.customers[0].name).toBe('Aston Martin');
  });

  it('removing a customer takes it out of the order and nothing else', () => {
    let data = addCustomer(addCustomer(base(), 'A'), 'B');
    const id = data.customers[0].id;
    const label = data.customers[0].label;
    data = removeCustomer(data, id);
    expect(data.customers.map((c) => c.name)).toEqual(['B']);
    expect(data.customerOrder).not.toContain(id);
    // Nothing in the document pretends to have touched Todoist.
    expect(label).toBe('a');
  });

  it('holds a custom order to customers that exist, each once', () => {
    let data = addCustomer(addCustomer(base(), 'A'), 'B');
    const [a, b] = data.customers.map((c) => c.id);
    data = setCustomerOrder(data, [b, 'gone', a, b]);
    expect(data.customerOrder).toEqual([b, a]);
  });

  it('sets the fields the table edits', () => {
    let data = addCustomer(base(), 'A');
    data = setCustomer(data, lastCustomer(data), { tier: 'P1', stage: 'risk' });
    expect(data.customers[0]).toMatchObject({ tier: 'P1', stage: 'risk' });
  });
});

describe('CSMs', () => {
  it('removing a CSM leaves their customers without one', () => {
    let data = addCsm(base(), 'Alex');
    const csm = data.csms[0].id;
    data = addCustomer(data, 'A');
    data = setCustomer(data, lastCustomer(data), { csm });
    expect(data.customers[0].csm).toBe(csm);

    data = removeCsm(data, csm);
    expect(data.csms).toEqual([]);
    expect(data.customers[0].csm).toBeNull();
  });
});

describe('stages', () => {
  it('removing a stage moves its customers to the first one left', () => {
    let data = addCustomer(base(), 'A');
    data = setCustomer(data, lastCustomer(data), { stage: 'risk' });
    data = removeStage(data, 'risk');
    expect(data.stages.map((s) => s.id)).toEqual(['onboarding', 'healthy', 'attention']);
    expect(data.customers[0].stage).toBe('onboarding');
  });

  /* Every customer is at a stage, so the list can never be emptied. */
  it('refuses to remove the last stage', () => {
    let data = base();
    for (const id of ['healthy', 'attention', 'risk']) data = removeStage(data, id);
    expect(data.stages).toHaveLength(1);
    const before = data;
    expect(removeStage(data, 'onboarding')).toBe(before);
  });

  it('ignores a stage it does not have', () => {
    const data = base();
    expect(removeStage(data, 'nope')).toBe(data);
  });

  it('adds, renames and moves within the list', () => {
    let data = addStage(base(), 'Paused', 'gray');
    expect(data.stages).toHaveLength(5);
    const id = data.stages[4].id;
    data = renameStage(data, id, 'On hold');
    expect(data.stages[4].name).toBe('On hold');

    data = moveStage(data, id, -1);
    expect(data.stages[3].id).toBe(id);
    // The ends hold: a move off either edge does nothing.
    expect(moveStage(data, 'onboarding', -1).stages[0].id).toBe('onboarding');
    expect(moveStage(data, id, 99).stages[3].id).toBe(id);
  });

  it('steps a tone through the five and round', () => {
    let data = base();
    expect(data.stages[0].tone).toBe('blue');
    for (let step = 0; step < 5; step += 1) data = cycleTone(data, 'onboarding');
    expect(data.stages[0].tone).toBe('blue');
  });
});

describe('focus areas', () => {
  it('adds one with its focus- label', () => {
    const data = addFocusArea(base(), 'Partner Enablement');
    expect(data.focusAreas[3].label).toBe('focus-partner-enablement');
  });

  it('removing one leaves its goals without a focus', () => {
    let data = addGoal(base(), 'fw', 'Ship the framework');
    data = removeFocusArea(data, 'fw');
    expect(data.focusAreas.map((f) => f.id)).toEqual(['sc', 'va']);
    expect(data.goals[0].focus).toBe('');
  });
});

describe('goals and KPIs', () => {
  it('removing a goal deletes its KPIs and unlinks what supported it', () => {
    let data = addGoal(base(), 'fw', 'Ship the framework');
    const goal = data.goals[0].id;
    data = addKpi(data, goal, { name: 'Adoption', unit: '%', start: 10, target: 50 });
    data = addGoal(data, 'sc', 'Other goal');
    const other = data.goals[1].id;
    data = addKpi(data, other, { name: 'Keep me', unit: '', start: 0, target: 1 });
    data = linkInitiativeGoal(data, 'task-1', goal);
    data = linkInitiativeGoal(data, 'task-2', other);
    data = linkObjectiveGoal(data, 'obj-1', goal);

    data = removeGoal(data, goal);
    expect(data.goals.map((g) => g.id)).toEqual([other]);
    expect(data.kpis.map((k) => k.name)).toEqual(['Keep me']);
    // The tasks stay in Todoist; they simply support nothing now.
    expect(data.initiativeGoals).toEqual({ 'task-2': other });
    expect(data.objectiveGoals).toEqual({});
  });

  it('removes a KPI on its own', () => {
    let data = addGoal(base(), 'fw', 'G');
    data = addKpi(data, data.goals[0].id, { name: 'K', unit: '', start: 0, target: 1 });
    data = removeKpi(data, data.kpis[0].id);
    expect(data.kpis).toEqual([]);
  });

  it('logs a value in date order', () => {
    let data = addGoal(base(), 'fw', 'G');
    data = addKpi(data, data.goals[0].id, { name: 'K', unit: '%', start: 0, target: 100 });
    const kpi = data.kpis[0].id;
    data = logKpiValue(data, kpi, 20, '2026-03-01');
    data = logKpiValue(data, kpi, 12, '2026-01-01');
    expect(data.kpis[0].history.map((p) => p.value)).toEqual([12, 20]);
  });

  /* Correcting today's number must not leave a step behind that kpiDelta
     would later read as movement. */
  it('replaces a value logged twice on the same day', () => {
    let data = addGoal(base(), 'fw', 'G');
    data = addKpi(data, data.goals[0].id, { name: 'K', unit: '%', start: 0, target: 100 });
    const kpi = data.kpis[0].id;
    data = logKpiValue(data, kpi, 20, '2026-03-01');
    data = logKpiValue(data, kpi, 25, '2026-03-01');
    expect(data.kpis[0].history).toEqual([{ at: '2026-03-01', value: 25 }]);
  });

  it('ignores a value logged against a KPI that is gone', () => {
    const data = base();
    expect(logKpiValue(data, 'nope', 1, '2026-01-01')).toBe(data);
  });
});

describe('links to Todoist tasks', () => {
  it('links and unlinks', () => {
    let data = linkInitiativeGoal(base(), 'task-1', 'g1');
    expect(data.initiativeGoals).toEqual({ 'task-1': 'g1' });
    data = linkInitiativeGoal(data, 'task-1', null);
    expect(data.initiativeGoals).toEqual({});

    data = linkObjective(data, 'obj-1', 'obj-parent');
    expect(data.objectiveParents).toEqual({ 'obj-1': 'obj-parent' });
  });

  it('forgets links naming tasks Todoist no longer has', () => {
    let data = linkInitiativeGoal(base(), 'gone', 'g1');
    data = linkInitiativeGoal(data, 'alive', 'g1');
    data = linkObjectiveGoal(data, 'gone-too', 'g1');
    data = linkObjective(data, 'alive', 'gone');

    data = pruneLinks(data, new Set(['alive']));
    expect(data.initiativeGoals).toEqual({ alive: 'g1' });
    expect(data.objectiveGoals).toEqual({});
    // A parent that is gone leaves its child parentless, not pointing at nothing.
    expect(data.objectiveParents).toEqual({});
  });
});

describe('notes and settings', () => {
  it('keeps a note and drops an emptied one', () => {
    let data = setNote(base(), 'w:2026-W40', 'Ship the framework draft');
    expect(data.notes['w:2026-W40']).toBe('Ship the framework draft');
    data = setNote(data, 'w:2026-W40', '   ');
    expect(data.notes).toEqual({});
  });

  it('patches settings without losing the rest', () => {
    const data = setSettings(base(), { soonDays: 14 });
    expect(data.settings.soonDays).toBe(14);
    expect(data.settings.objectiveCaps).toEqual({ d: 3, w: 5, m: 3, q: 3 });
  });
});

describe('every action is pure', () => {
  it('never changes the document it was given', () => {
    const data = addCustomer(base(), 'A');
    const copy = structuredClone(data);
    removeCustomer(data, lastCustomer(data));
    renameCustomer(data, lastCustomer(data), 'B');
    removeStage(data, 'healthy');
    removeGoal(data, 'nope');
    setNote(data, 'k', 'v');
    expect(data).toEqual(copy);
  });
});

describe('remapTaskIds', () => {
  /* A task created here has a temporary id until Todoist answers. A link made
     in the same breath has to follow it, or it names something that has
     stopped existing and pruneLinks quietly drops it. */
  it('follows a task from its temp id to its real one', () => {
    let data = linkObjective(base(), 'temp-1', 'parent-1');
    data = linkInitiativeGoal(data, 'temp-2', 'g1');
    data = linkObjectiveGoal(data, 'temp-1', 'g1');

    data = remapTaskIds(data, { 'temp-1': 'real-1', 'temp-2': 'real-2' });
    expect(data.objectiveParents).toEqual({ 'real-1': 'parent-1' });
    expect(data.initiativeGoals).toEqual({ 'real-2': 'g1' });
    expect(data.objectiveGoals).toEqual({ 'real-1': 'g1' });
  });

  /* The parent can have been created just as recently as its child. */
  it('remaps the parent as well as the child', () => {
    const data = remapTaskIds(
      linkObjective(base(), 'temp-child', 'temp-parent'),
      { 'temp-child': 'real-child', 'temp-parent': 'real-parent' },
    );
    expect(data.objectiveParents).toEqual({ 'real-child': 'real-parent' });
  });

  it('leaves alone the links it knows nothing about', () => {
    const data = linkObjective(base(), 'real-1', 'real-2');
    expect(remapTaskIds(data, { 'temp-9': 'real-9' })).toBe(data);
    expect(remapTaskIds(data, {})).toBe(data);
  });

  it('keeps the document it was given untouched', () => {
    const data = linkObjective(base(), 'temp-1', 'p');
    const copy = structuredClone(data);
    remapTaskIds(data, { 'temp-1': 'real-1' });
    expect(data).toEqual(copy);
  });
});
