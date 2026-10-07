/**
 * Extension data: the one JSON document the fork keeps for everything Todoist
 * has no field for.
 *
 * Todoist stays the truth for anything that is work — tasks, labels, dates,
 * completion. This holds what has nowhere to go there: who the CSM is, what
 * stage a customer is at, the goals and KPIs, the links between objectives, and
 * the notes on a period. See docs/ext/DATA-MODEL.md §2.
 *
 * It travels in its own Inbox comment (`comment.ts`) and is cached on the
 * device, the same way upstream carries its settings.
 */

/** The five meanings a stage chip can carry, as tokens rather than colours. */
export type Tone = 'blue' | 'green' | 'amber' | 'red' | 'gray';

export type Tier = 'P1' | 'P2' | 'P3';

export interface ExtSettings {
  /** The marker label names. Editable, because an account may already use others. */
  labels: {
    engagement: string;
    initiative: string;
    objective: string;
    periodPrefix: string;
    focusPrefix: string;
    statusPrefix: string;
  };
  /** Where new initiatives go. Null means the Inbox. */
  initiativesProjectId: string | null;
  objectivesProjectId: string | null;
  customersProjectId: string | null;
  /** Today shows engagements due within this many days. */
  soonDays: number;
  /** How many objectives belong in a day, week, month and quarter. */
  objectiveCaps: { d: number; w: number; m: number; q: number };
  /** Completed actions per week below which a focus area is not moving. */
  momentumFloor: number;
  /** 1 = the calendar year, for the share-of-year a KPI's pace is measured against. */
  yearStartMonth: number;
}

export interface Csm {
  id: string;
  name: string;
}

export interface Stage {
  id: string;
  name: string;
  tone: Tone;
}

export interface Customer {
  id: string;
  name: string;
  /** The Todoist label name. Renaming the customer never touches it. */
  label: string;
  csm: string | null;
  stage: string;
  tier: Tier;
  /** A Todoist colour name, so src/domain/colors.ts renders it. */
  color: string;
}

export interface FocusArea {
  id: string;
  name: string;
  short: string;
  label: string;
  color: string;
  why: string;
}

export interface Goal {
  id: string;
  focus: string;
  title: string;
}

export interface KpiPoint {
  /** ISO date. */
  at: string;
  value: number;
}

export interface Kpi {
  id: string;
  goal: string;
  name: string;
  unit: string;
  start: number;
  target: number;
  /** Oldest first; the last entry is the current value. */
  history: KpiPoint[];
}

export interface ExtData {
  /** Schema version. `migrate` brings anything older up to this. */
  v: 1;
  /** When this document was written. Decides which of two comments is current. */
  savedAt: number;
  settings: ExtSettings;
  csms: Csm[];
  stages: Stage[];
  customers: Customer[];
  /** Custom sort order, by customer id. */
  customerOrder: string[];
  focusAreas: FocusArea[];
  goals: Goal[];
  kpis: Kpi[];
  /** Todoist task id → goal id. */
  initiativeGoals: Record<string, string>;
  /** Objective task id → parent objective task id. */
  objectiveParents: Record<string, string>;
  /** Quarter objective task id → goal id. */
  objectiveGoals: Record<string, string>;
  /** 'd:2026-09-29' | 'w:2026-W40' | 'm:2026-09' | 'q:2026-Q3' → text. */
  notes: Record<string, string>;
}
