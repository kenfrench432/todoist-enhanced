import type { ExtData, ExtSettings, FocusArea, Stage } from './types';

/**
 * A short id for anything the user creates. Eight characters is plenty for one
 * person's customers and goals, and keeps the document readable.
 */
export const newId = (): string => crypto.randomUUID().slice(0, 8);

/**
 * The colours a new customer or focus area is given, in turn.
 *
 * Todoist colour names, not hex, so `colorValue` and `colorSoft` in
 * `src/domain/colors.ts` render them and the fork adds no second palette.
 */
export const EXT_PALETTE = [
  'green', 'red', 'grape', 'orange', 'blue',
  'teal', 'charcoal', 'violet', 'olive_green', 'magenta',
] as const;

/** The next colour to hand out, so a new customer rarely repeats its neighbour. */
export const paletteColor = (index: number): string =>
  EXT_PALETTE[index % EXT_PALETTE.length];

/**
 * The default stages and focus areas carry **fixed** ids, never `newId()`.
 *
 * Two devices starting fresh would otherwise invent different ids for the same
 * four stages, and every customer's `stage` would point at something the other
 * device has never heard of. A default is the same thing everywhere, so it has
 * the same id everywhere.
 */
export const DEFAULT_STAGES: Stage[] = [
  { id: 'onboarding', name: 'Onboarding', tone: 'blue' },
  { id: 'healthy', name: 'Healthy', tone: 'green' },
  { id: 'attention', name: 'Needs attention', tone: 'amber' },
  { id: 'risk', name: 'At risk', tone: 'red' },
];

export const DEFAULT_FOCUS_AREAS: FocusArea[] = [
  {
    id: 'fw',
    name: 'Bynder Maturity Framework',
    short: 'Maturity Framework',
    label: 'focus-maturity-framework',
    color: 'grape',
    why: 'Turn assessments into transformation roadmaps that customers and partners execute.',
  },
  {
    id: 'sc',
    name: 'Scaling Book of Business',
    short: 'Scaling Book of Business',
    label: 'focus-scaling-bob',
    color: 'blue',
    why: 'Serve the whole portfolio with a repeatable, tiered motion instead of ad-hoc effort.',
  },
  {
    id: 'va',
    name: 'Measuring Value of TSM',
    short: 'Measuring Value of TSM',
    label: 'focus-tsm-value',
    color: 'teal',
    why: 'Show how technical success moves adoption, retention and expansion.',
  },
];

export const defaultSettings = (): ExtSettings => ({
  labels: {
    engagement: 'engagement',
    initiative: 'initiative',
    objective: 'objective',
    periodPrefix: 'period-',
    focusPrefix: 'focus-',
    statusPrefix: 'status-',
  },
  excludedProjectIds: [],
  initiativesProjectId: null,
  objectivesProjectId: null,
  customersProjectId: null,
  soonDays: 7,
  objectiveCaps: { d: 3, w: 5, m: 3, q: 3 },
  momentumFloor: 2,
  yearStartMonth: 1,
});

/** A document for an account that has never used the fork. */
export const defaultExtData = (savedAt = 0): ExtData => ({
  v: 1,
  savedAt,
  settings: defaultSettings(),
  csms: [],
  stages: DEFAULT_STAGES.map((stage) => ({ ...stage })),
  customers: [],
  customerOrder: [],
  focusAreas: DEFAULT_FOCUS_AREAS.map((area) => ({ ...area })),
  goals: [],
  kpis: [],
  initiativeGoals: {},
  objectiveParents: {},
  objectiveGoals: {},
  notes: {},
});
