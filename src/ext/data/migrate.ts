import {
  DEFAULT_STAGES, defaultExtData, defaultSettings, paletteColor,
} from './defaults';
import type {
  Csm, Customer, ExtData, ExtSettings, FocusArea, Goal, Kpi, KpiPoint, Stage, Tier, Tone,
} from './types';

/** The schema version this build writes. */
export const EXT_VERSION = 1;

const TONES: Tone[] = ['blue', 'green', 'amber', 'red', 'gray'];
const TIERS: Tier[] = ['P1', 'P2', 'P3'];

type Raw = Record<string, unknown>;

const isObject = (value: unknown): value is Raw =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const str = (value: unknown, fallback: string): string =>
  typeof value === 'string' ? value : fallback;

const num = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const nullableStr = (value: unknown): string | null =>
  typeof value === 'string' ? value : null;

const arr = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

/** A string→string map, dropping anything that is not one. */
function strMap(value: unknown): Record<string, string> {
  if (!isObject(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'string') out[key] = entry;
  }
  return out;
}

/** Keeps only entries with a usable id, and drops a repeated one. */
function byId<T extends { id: string }>(rows: Array<T | null>): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    if (!row || !row.id || seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }
  return out;
}

function readSettings(value: unknown): ExtSettings {
  const base = defaultSettings();
  if (!isObject(value)) return base;
  const labels = isObject(value.labels) ? value.labels : {};
  const caps = isObject(value.objectiveCaps) ? value.objectiveCaps : {};
  return {
    labels: {
      engagement: str(labels.engagement, base.labels.engagement),
      initiative: str(labels.initiative, base.labels.initiative),
      objective: str(labels.objective, base.labels.objective),
      periodPrefix: str(labels.periodPrefix, base.labels.periodPrefix),
      focusPrefix: str(labels.focusPrefix, base.labels.focusPrefix),
      statusPrefix: str(labels.statusPrefix, base.labels.statusPrefix),
    },
    excludedProjectIds: arr(value.excludedProjectIds)
      .filter((id): id is string => typeof id === 'string' && id.length > 0),
    initiativesProjectId: nullableStr(value.initiativesProjectId),
    objectivesProjectId: nullableStr(value.objectivesProjectId),
    customersProjectId: nullableStr(value.customersProjectId),
    soonDays: num(value.soonDays, base.soonDays),
    objectiveCaps: {
      d: num(caps.d, base.objectiveCaps.d),
      w: num(caps.w, base.objectiveCaps.w),
      m: num(caps.m, base.objectiveCaps.m),
      q: num(caps.q, base.objectiveCaps.q),
    },
    momentumFloor: num(value.momentumFloor, base.momentumFloor),
    yearStartMonth: num(value.yearStartMonth, base.yearStartMonth),
  };
}

const readCsm = (value: unknown): Csm | null =>
  isObject(value) && typeof value.id === 'string'
    ? { id: value.id, name: str(value.name, value.id) }
    : null;

const readStage = (value: unknown): Stage | null =>
  isObject(value) && typeof value.id === 'string'
    ? {
      id: value.id,
      name: str(value.name, value.id),
      tone: TONES.includes(value.tone as Tone) ? (value.tone as Tone) : 'gray',
    }
    : null;

function readCustomer(value: unknown, index: number, firstStage: string): Customer | null {
  if (!isObject(value) || typeof value.id !== 'string') return null;
  const name = str(value.name, value.id);
  return {
    id: value.id,
    name,
    label: str(value.label, ''),
    csm: nullableStr(value.csm),
    stage: str(value.stage, firstStage),
    tier: TIERS.includes(value.tier as Tier) ? (value.tier as Tier) : 'P3',
    color: str(value.color, paletteColor(index)),
  };
}

function readFocusArea(value: unknown, index: number): FocusArea | null {
  if (!isObject(value) || typeof value.id !== 'string') return null;
  const name = str(value.name, value.id);
  return {
    id: value.id,
    name,
    short: str(value.short, name),
    label: str(value.label, ''),
    color: str(value.color, paletteColor(index)),
    why: str(value.why, ''),
  };
}

const readGoal = (value: unknown): Goal | null =>
  isObject(value) && typeof value.id === 'string'
    ? { id: value.id, focus: str(value.focus, ''), title: str(value.title, '') }
    : null;

function readKpi(value: unknown): Kpi | null {
  if (!isObject(value) || typeof value.id !== 'string') return null;
  const history = arr(value.history)
    .map((point): KpiPoint | null =>
      isObject(point) && typeof point.at === 'string' && typeof point.value === 'number'
        ? { at: point.at, value: point.value }
        : null)
    .filter((point): point is KpiPoint => point !== null)
    .sort((a, b) => a.at.localeCompare(b.at));
  return {
    id: value.id,
    goal: str(value.goal, ''),
    name: str(value.name, ''),
    unit: str(value.unit, ''),
    start: num(value.start, 0),
    target: num(value.target, 0),
    history,
  };
}

/**
 * Any stored document, read as one this build understands.
 *
 * Total by design: it never throws and always hands back something usable, so
 * a half-written comment, a document from an older build, or a field somebody
 * edited by hand can never stop the app from opening. Anything unreadable
 * falls back to its default rather than being dropped on the floor.
 *
 * A document with no `v` is the shape written before versioning; there is only
 * one version so far, so bringing it up to date is reading it field by field.
 * A `v` from a newer build is read the same way — the fields this build knows
 * survive, and anything that version added does not. When a v2 exists, its
 * migration belongs here, in order.
 */
export function migrate(input: unknown): ExtData {
  if (!isObject(input)) return defaultExtData();

  const stages = byId(arr(input.stages).map(readStage));
  /* A document must always have a stage to put a customer at: an account with
     the list emptied by hand gets the defaults back rather than customers
     pointing at nothing. */
  const safeStages = stages.length > 0 ? stages : DEFAULT_STAGES.map((s) => ({ ...s }));
  const firstStage = safeStages[0].id;

  const customers = byId(
    arr(input.customers).map((row, index) => readCustomer(row, index, firstStage)),
  );
  const known = new Set(customers.map((customer) => customer.id));

  return {
    v: EXT_VERSION,
    savedAt: num(input.savedAt, 0),
    settings: readSettings(input.settings),
    csms: byId(arr(input.csms).map(readCsm)),
    stages: safeStages,
    customers,
    /* The order is a view of the list, so it can only name customers that are
       in it, each once. */
    customerOrder: arr(input.customerOrder)
      .filter((id): id is string => typeof id === 'string' && known.has(id))
      .filter((id, index, all) => all.indexOf(id) === index),
    focusAreas: byId(arr(input.focusAreas).map(readFocusArea)),
    goals: byId(arr(input.goals).map(readGoal)),
    kpis: byId(arr(input.kpis).map(readKpi)),
    initiativeGoals: strMap(input.initiativeGoals),
    objectiveParents: strMap(input.objectiveParents),
    objectiveGoals: strMap(input.objectiveGoals),
    notes: strMap(input.notes),
  };
}
