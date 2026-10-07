import { slug } from '@/ext/domain/labels';
import { newId, paletteColor } from './defaults';
import type {
  Csm, Customer, ExtData, ExtSettings, FocusArea, Goal, Kpi, Stage, Tier, Tone,
} from './types';

/**
 * Every change the fork makes to its document.
 *
 * All of them are `(data, …) => data` and none of them reads a clock, a store
 * or the network, so each integrity rule in DATA-MODEL.md is one line of test.
 * The store applies them through `update(fn)`, which is what stamps `savedAt`.
 */

const TONES: Tone[] = ['blue', 'green', 'amber', 'red', 'gray'];

const without = <T extends { id: string }>(rows: T[], id: string): T[] =>
  rows.filter((row) => row.id !== id);

/* NoInfer on the change, or a caller passing a narrower Partial<Pick<...>>
   would decide what T is and lose the rest of the row's type. */
const patch = <T extends { id: string }>(
  rows: T[], id: string, change: Partial<NoInfer<T>>,
): T[] => rows.map((row) => (row.id === id ? { ...row, ...change } : row));

/** Drops the keys of a map whose value is one of these ids. */
function dropByValue(map: Record<string, string>, ids: Set<string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(map)) if (!ids.has(value)) out[key] = value;
  return out;
}

/* ---------- Customers ---------- */

export function addCustomer(data: ExtData, name: string, label = slug(name)): ExtData {
  const customer: Customer = {
    id: newId(),
    name: name.trim(),
    label,
    csm: null,
    stage: data.stages[0].id,
    tier: 'P3',
    color: paletteColor(data.customers.length),
  };
  return {
    ...data,
    customers: [...data.customers, customer],
    customerOrder: [...data.customerOrder, customer.id],
  };
}

/**
 * Renames the customer and **not** its label.
 *
 * The label is on every one of that customer's tasks in Todoist; renaming it
 * is a separate, explicit action (`renameCustomerLabel`) because it rewrites
 * their history, not just this list.
 */
export const renameCustomer = (data: ExtData, id: string, name: string): ExtData =>
  ({ ...data, customers: patch(data.customers, id, { name: name.trim() }) });

/** The deliberate one: this is what the caller pairs with a Todoist label rename. */
export const renameCustomerLabel = (data: ExtData, id: string, label: string): ExtData =>
  ({ ...data, customers: patch(data.customers, id, { label }) });

export const setCustomer = (
  data: ExtData,
  id: string,
  change: Partial<Pick<Customer, 'csm' | 'stage' | 'tier' | 'color'>>,
): ExtData => ({ ...data, customers: patch(data.customers, id, change) });

/** Removes the customer from this list only: its label and tasks stay in Todoist. */
export const removeCustomer = (data: ExtData, id: string): ExtData => ({
  ...data,
  customers: without(data.customers, id),
  customerOrder: data.customerOrder.filter((entry) => entry !== id),
});

export const setCustomerOrder = (data: ExtData, order: string[]): ExtData => {
  const known = new Set(data.customers.map((customer) => customer.id));
  return {
    ...data,
    customerOrder: order.filter((id, index) => known.has(id) && order.indexOf(id) === index),
  };
};

/* ---------- CSMs ---------- */

export function addCsm(data: ExtData, name: string): ExtData {
  const csm: Csm = { id: newId(), name: name.trim() };
  return { ...data, csms: [...data.csms, csm] };
}

export const renameCsm = (data: ExtData, id: string, name: string): ExtData =>
  ({ ...data, csms: patch(data.csms, id, { name: name.trim() }) });

/** Their customers keep their place and simply have no CSM. */
export const removeCsm = (data: ExtData, id: string): ExtData => ({
  ...data,
  csms: without(data.csms, id),
  customers: data.customers.map((customer) =>
    (customer.csm === id ? { ...customer, csm: null } : customer)),
});

/* ---------- Stages ---------- */

export function addStage(data: ExtData, name: string, tone: Tone = 'gray'): ExtData {
  const stage: Stage = { id: newId(), name: name.trim(), tone };
  return { ...data, stages: [...data.stages, stage] };
}

export const renameStage = (data: ExtData, id: string, name: string): ExtData =>
  ({ ...data, stages: patch(data.stages, id, { name: name.trim() }) });

/**
 * Removes a stage, moving its customers to the first one left.
 *
 * The last stage cannot go: every customer is at a stage, so emptying the list
 * would leave the whole table pointing at nothing.
 */
export function removeStage(data: ExtData, id: string): ExtData {
  if (data.stages.length <= 1 || !data.stages.some((stage) => stage.id === id)) return data;
  const stages = without(data.stages, id);
  const first = stages[0].id;
  return {
    ...data,
    stages,
    customers: data.customers.map((customer) =>
      (customer.stage === id ? { ...customer, stage: first } : customer)),
  };
}

/** Moves a stage one place up or down, since the order is the health scale. */
export function moveStage(data: ExtData, id: string, delta: number): ExtData {
  const from = data.stages.findIndex((stage) => stage.id === id);
  if (from === -1) return data;
  const to = from + delta;
  if (to < 0 || to >= data.stages.length) return data;
  const stages = [...data.stages];
  const [moved] = stages.splice(from, 1);
  stages.splice(to, 0, moved);
  return { ...data, stages };
}

/** Steps a stage's tone through the five, so one control sets the colour. */
export function cycleTone(data: ExtData, id: string): ExtData {
  const stage = data.stages.find((entry) => entry.id === id);
  if (!stage) return data;
  const next = TONES[(TONES.indexOf(stage.tone) + 1) % TONES.length];
  return { ...data, stages: patch(data.stages, id, { tone: next }) };
}

/* ---------- Focus areas ---------- */

export function addFocusArea(data: ExtData, name: string): ExtData {
  const area: FocusArea = {
    id: newId(),
    name: name.trim(),
    short: name.trim(),
    label: `${data.settings.labels.focusPrefix}${slug(name)}`,
    color: paletteColor(data.focusAreas.length),
    why: '',
  };
  return { ...data, focusAreas: [...data.focusAreas, area] };
}

export const updateFocusArea = (
  data: ExtData, id: string, change: Partial<Omit<FocusArea, 'id'>>,
): ExtData => ({ ...data, focusAreas: patch(data.focusAreas, id, change) });

/** Its goals lose their focus; nothing is deleted on the way out. */
export const removeFocusArea = (data: ExtData, id: string): ExtData => ({
  ...data,
  focusAreas: without(data.focusAreas, id),
  goals: data.goals.map((goal) => (goal.focus === id ? { ...goal, focus: '' } : goal)),
});

/* ---------- Goals and KPIs ---------- */

export function addGoal(data: ExtData, focus: string, title: string): ExtData {
  const goal: Goal = { id: newId(), focus, title: title.trim() };
  return { ...data, goals: [...data.goals, goal] };
}

export const updateGoal = (
  data: ExtData, id: string, change: Partial<Omit<Goal, 'id'>>,
): ExtData => ({ ...data, goals: patch(data.goals, id, change) });

/**
 * Removes a goal and everything that only existed to point at it.
 *
 * Its KPIs go with it, and the initiatives and quarter objectives that
 * supported it are unlinked — they are Todoist tasks and stay exactly where
 * they are, they just no longer support a goal that is gone.
 */
export function removeGoal(data: ExtData, id: string): ExtData {
  const orphaned = new Set([id]);
  return {
    ...data,
    goals: without(data.goals, id),
    kpis: data.kpis.filter((kpi) => kpi.goal !== id),
    initiativeGoals: dropByValue(data.initiativeGoals, orphaned),
    objectiveGoals: dropByValue(data.objectiveGoals, orphaned),
  };
}

export function addKpi(
  data: ExtData,
  goal: string,
  kpi: Pick<Kpi, 'name' | 'unit' | 'start' | 'target'>,
): ExtData {
  const row: Kpi = { id: newId(), goal, ...kpi, history: [] };
  return { ...data, kpis: [...data.kpis, row] };
}

export const updateKpi = (
  data: ExtData, id: string, change: Partial<Omit<Kpi, 'id' | 'history'>>,
): ExtData => ({ ...data, kpis: patch(data.kpis, id, change) });

export const removeKpi = (data: ExtData, id: string): ExtData =>
  ({ ...data, kpis: without(data.kpis, id) });

/**
 * Records where a KPI stands today.
 *
 * Two readings on the same date are one reading: the later replaces the
 * earlier, so correcting a number does not leave a step in the history that
 * `kpiDelta` would later read as movement. `at` is passed in, never read from
 * a clock, so the rule can be tested on a fixed date.
 */
export function logKpiValue(data: ExtData, id: string, value: number, at: string): ExtData {
  const kpi = data.kpis.find((row) => row.id === id);
  if (!kpi) return data;
  const history = [...kpi.history.filter((point) => point.at !== at), { at, value }]
    .sort((a, b) => a.at.localeCompare(b.at));
  return { ...data, kpis: patch(data.kpis, id, { history }) };
}

/* ---------- Links to Todoist tasks ---------- */

/** Links an initiative task to a goal, or clears the link when goal is null. */
export const linkInitiativeGoal = (data: ExtData, taskId: string, goal: string | null): ExtData =>
  ({ ...data, initiativeGoals: link(data.initiativeGoals, taskId, goal) });

export const linkObjectiveGoal = (data: ExtData, taskId: string, goal: string | null): ExtData =>
  ({ ...data, objectiveGoals: link(data.objectiveGoals, taskId, goal) });

export const linkObjective = (data: ExtData, taskId: string, parent: string | null): ExtData =>
  ({ ...data, objectiveParents: link(data.objectiveParents, taskId, parent) });

function link(
  map: Record<string, string>, key: string, value: string | null,
): Record<string, string> {
  if (value === null) {
    const { [key]: _gone, ...rest } = map;
    return rest;
  }
  return { ...map, [key]: value };
}

/**
 * Forgets links naming tasks Todoist no longer has.
 *
 * Links are read leniently — a missing task is simply not shown — but they are
 * pruned when the document is next written, so a year of deleted tasks does
 * not quietly grow the comment towards its size limit.
 */
export function pruneLinks(data: ExtData, liveTaskIds: Set<string>): ExtData {
  const keep = (map: Record<string, string>): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const [taskId, value] of Object.entries(map)) {
      if (liveTaskIds.has(taskId)) out[taskId] = value;
    }
    return out;
  };
  const parents = keep(data.objectiveParents);
  return {
    ...data,
    initiativeGoals: keep(data.initiativeGoals),
    objectiveGoals: keep(data.objectiveGoals),
    /* A parent that is gone leaves its children parentless rather than
       pointing at a task that no longer exists. */
    objectiveParents: Object.fromEntries(
      Object.entries(parents).filter(([, parent]) => liveTaskIds.has(parent)),
    ),
  };
}

/* ---------- Notes and settings ---------- */

/** A period's note. An empty note is removed rather than stored blank. */
export function setNote(data: ExtData, key: string, text: string): ExtData {
  if (!text.trim()) {
    const { [key]: _gone, ...notes } = data.notes;
    return { ...data, notes };
  }
  return { ...data, notes: { ...data.notes, [key]: text } };
}

export const setSettings = (data: ExtData, change: Partial<ExtSettings>): ExtData =>
  ({ ...data, settings: { ...data.settings, ...change } });

export type { Tier };

/**
 * Rewrites the task ids a link names, after Todoist has resolved them.
 *
 * A task created in the app lives under a temporary id until Todoist answers
 * with the real one. A link made in the same breath — the parent chosen on the
 * new-objective form, say — would otherwise name an id that stops existing a
 * second later, and `pruneLinks` would quietly drop it. The store applies this
 * whenever `resolvedIds` grows.
 *
 * Both sides are remapped: an objective's parent can have been created just as
 * recently as the objective itself.
 */
export function remapTaskIds(data: ExtData, mapping: Record<string, string>): ExtData {
  if (Object.keys(mapping).length === 0) return data;
  const id = (value: string) => mapping[value] ?? value;

  const remapKeys = (map: Record<string, string>): Record<string, string> =>
    Object.fromEntries(Object.entries(map).map(([task, value]) => [id(task), value]));

  const changed = (map: Record<string, string>) =>
    Object.keys(map).some((task) => task in mapping);

  const parentsNeedWork = changed(data.objectiveParents)
    || Object.values(data.objectiveParents).some((parent) => parent in mapping);
  if (!changed(data.initiativeGoals) && !changed(data.objectiveGoals) && !parentsNeedWork) {
    return data;
  }

  return {
    ...data,
    initiativeGoals: remapKeys(data.initiativeGoals),
    objectiveGoals: remapKeys(data.objectiveGoals),
    objectiveParents: Object.fromEntries(
      Object.entries(data.objectiveParents).map(([task, parent]) => [id(task), id(parent)]),
    ),
  };
}
