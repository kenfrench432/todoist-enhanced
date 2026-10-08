import { useCallback } from 'react';
import { useStore } from '@/store/store';
import type { Locale } from '@/i18n';
import type { ExtViewId } from './routes';

/**
 * The fork's own strings.
 *
 * Kept apart from `src/i18n/en.ts` so a new string is never a merge conflict.
 * Sentence case, no exclamation marks, and Ken's words: engagement,
 * initiative, focus area, objective, CSM, stage, tier.
 */
const EN = {
  'nav.customers': 'Customers',
  'nav.focus': 'Focus',
  'nav.objectives': 'Objectives',
  'nav.initiatives': 'Initiatives',
  'nav.goals': 'Goals & KPIs',
  'nav.manage': 'Manage',

  'page.customers.title': 'Customers',
  'page.customers.soon': 'Customer tasks and engagements, grouped by customer.',
  'page.objectives.title': 'Objectives',
  'page.objectives.soon':
    'A few outcomes per day, week, month and quarter. Each one supports the level above it.',
  'page.initiatives.title': 'Initiatives',
  'page.initiatives.soon': 'Internal projects, grouped by focus area.',
  'page.goals.title': 'Goals & KPIs',
  'page.goals.soon': 'Goals, KPI pace and focus-area momentum.',
  'page.manage.title': 'Manage',
  'page.manage.soon': 'Customers, CSMs, stages, goals and KPIs, initiatives.',

  'page.placeholder': 'This page arrives in a later phase.',

  // Manage
  'manage.tab.customers': 'Customers',
  'manage.tab.goals': 'Goals & KPIs',
  'manage.tab.initiatives': 'Initiatives',
  'manage.add': 'Add',
  'manage.remove': 'Remove',
  'manage.confirm': 'Confirm',
  'manage.cancel': 'Cancel',
  'manage.name': 'Name',
  'manage.duplicate': 'That name is already taken.',
  'manage.inbox': 'Inbox',
  'manage.none': 'None',
  'manage.unassigned': 'Unassigned',

  'manage.customers.add': 'Add customer',
  'manage.customers.addPlaceholder': 'Customer name',
  'manage.customers.labelPreview': 'Label',
  'manage.customers.csms': 'CSMs',
  'manage.customers.stages': 'Stages',
  'manage.customers.csmPlaceholder': 'New CSM',
  'manage.customers.stagePlaceholder': 'New stage',
  'manage.customers.noCsms': 'No CSMs yet',
  'manage.customers.colName': 'Customer',
  'manage.customers.colLabel': 'Todoist label',
  'manage.customers.colCsm': 'CSM',
  'manage.customers.colStage': 'Stage',
  'manage.customers.colTier': 'Tier',
  'manage.customers.colTasks': 'Open tasks',
  'manage.customers.empty': 'No customers yet. Add one above.',
  'manage.customers.hint':
    'Renaming a customer does not rename its label. Removing one keeps its label and tasks in Todoist.',
  'manage.customers.unlinked': 'Labels not linked to a customer',
  'manage.customers.unlinkedNone': 'Every label is accounted for.',
  'manage.customers.register': 'Register',
  'manage.customers.added': 'Customer added.',
  'manage.customers.where': 'New customer tasks go to',
  'manage.customers.lastStage': 'The last stage cannot be removed.',
  'manage.hidden.title': 'Projects hidden from this app',
  'manage.hidden.hint':
    'Their tasks are left out of every list — My week, Upcoming, search, and the fork\u2019s own pages. Hiding a project hides the ones nested under it. Nothing is archived in Todoist, and a hidden project\u2019s own page still shows its tasks.',
  'manage.hidden.none': 'Nothing is hidden.',
  'manage.hidden.count': '{count} hidden',
  'manage.customers.moveUp': 'Move up',
  'manage.customers.moveDown': 'Move down',
  'manage.customers.tone': 'Change the colour',
  'manage.label.missing': 'not in Todoist',
  'manage.label.create': 'Create it',
  'manage.label.hint':
    'Points this at a different label. Nothing is renamed \u2014 the tasks carrying the old one simply stop counting here.',
  'manage.focus.title': 'Focus areas',
  'manage.focus.name': 'Name',
  'manage.focus.short': 'Short name',
  'manage.focus.label': 'Label',
  'manage.focus.why': 'Why it matters',
  'manage.focus.add': 'New focus area',
  'manage.focus.addPlaceholder': 'What is the area?',
  'manage.focus.colour': 'Change the colour',
  'manage.focus.hint':
    'A focus area\u2019s label is what momentum counts and what new initiatives and objectives are tagged with. Changing it does not relabel anything already tagged.',
  'manage.focus.none': 'No focus areas yet.',

  'manage.goals.new': 'New goal',
  'manage.goals.titlePlaceholder': 'What is the goal?',
  'manage.goals.focus': 'Focus area',
  'manage.goals.noFocus': 'No focus area',
  'manage.goals.empty': 'No goals in this focus area yet.',
  'manage.goals.emptyAll': 'No goals yet. Add one below.',
  'manage.goals.addKpi': 'Add KPI',
  'manage.goals.kpiName': 'Name',
  'manage.goals.kpiNow': 'Now',
  'manage.goals.kpiStart': 'Start',
  'manage.goals.kpiTarget': 'Target',
  'manage.goals.kpiUnit': 'Unit',
  'manage.goals.noKpis': 'No KPIs on this goal.',
  'manage.goals.newKpi': 'New KPI',
  'manage.goals.removeHint': 'Removing a goal deletes its KPIs and unlinks its initiatives.',
  'manage.goals.linked': '{count} initiatives linked',
  'manage.goals.linked_one': '1 initiative linked',
  'manage.goals.linked_other': '{count} initiatives linked',

  'manage.initiatives.new': 'New initiative',
  'manage.initiatives.namePlaceholder': 'What is the initiative?',
  'manage.initiatives.status': 'Status',
  'manage.initiatives.target': 'Target',
  'manage.initiatives.goal': 'Supports goal',
  'manage.initiatives.noGoal': 'No goal',
  'manage.initiatives.blockedOn': 'Blocked on',
  'manage.initiatives.blockedPlaceholder': 'What is it waiting on?',
  'manage.initiatives.empty': 'No initiatives in this focus area yet.',
  'manage.initiatives.emptyAll': 'No initiatives yet. Add one below.',
  'manage.initiatives.where': 'New initiatives go to',
  'manage.initiatives.labelsPreview': 'Labels',
  'manage.initiatives.removeHint': 'Removing completes the Todoist task. It is never deleted.',
  'manage.initiatives.create': 'Create initiative',
  'manage.initiatives.created': 'Initiative created.',
  'manage.initiatives.tasks': '{open} open · {done} done',

  // Customers
  'customers.period': 'Period',
  'customers.period.today': 'Today',
  'customers.period.week': 'This week',
  'customers.period.all': 'All',
  'customers.whichCustomers': 'Customers',
  'customers.all': 'All',
  'customers.none': 'None',
  'customers.sort': 'Sort',
  'customers.sort.az': 'A–Z',
  'customers.sort.custom': 'Custom',
  'customers.moveUp': 'Move up',
  'customers.moveDown': 'Move down',
  'customers.filters': 'Filters',
  'customers.clearFilters': 'Clear filters',
  'customers.showEngagements': 'Show engagements',
  'customers.showEmpty': 'Show customers without tasks',
  'customers.noMatches': 'No customers match these filters',
  'customers.noCustomers': 'No customers yet. Add them on Manage.',
  'customers.noTasks': 'No open tasks',
  'customers.allQuiet': 'Nothing for any customer in this period.',
  'customers.add': 'Add to {name}',
  'customers.collapse': 'Collapse',
  'customers.engagements': 'Engagements',
  'customers.tasks': 'Tasks',
  'customers.progress': '{done} of {total} done',
  'customers.addTask': 'Add task',
  'customers.inEngagement': 'In an engagement',
  'customers.subtitle.tasks': '{count} tasks',
  'customers.subtitle.tasks_one': '1 task',
  'customers.subtitle.tasks_other': '{count} tasks',
  'customers.subtitle.engagements': '{count} engagements',
  'customers.subtitle.engagements_one': '1 engagement',
  'customers.subtitle.engagements_other': '{count} engagements',
  'customers.subtitle.customers': '{count} customers',
  'customers.subtitle.customers_one': '1 customer',
  'customers.subtitle.customers_other': '{count} customers',

  'composer.task': 'Task',
  'composer.engagement': 'Engagement',
  'composer.titleTask': 'What needs doing?',
  'composer.titleEngagement': 'What is the engagement?',
  'composer.due': 'Due',
  'composer.deadline': 'Deadline',
  'composer.due.today': 'Today',
  'composer.due.tomorrow': 'Tomorrow',
  'composer.due.week': 'This week',
  'composer.due.none': 'No date',
  'composer.deadline.1w': 'In 1 week',
  'composer.deadline.2w': 'In 2 weeks',
  'composer.deadline.1m': 'In a month',
  'composer.deadline.none': 'No deadline',
  'composer.priority': 'Priority',
  'composer.labels': 'Labels',
  'composer.add': 'Add',
  'composer.cancel': 'Cancel',
  'composer.added': 'Added \u201c{title}\u201d to {customer} with label @{label}.',

  // Initiatives
  'initiatives.groupBy': 'Group by',
  'initiatives.groupBy.focus': 'Focus area',
  'initiatives.groupBy.status': 'Status',
  'initiatives.allFocus': 'All focus areas',
  'initiatives.showCompleted': 'Show completed',
  'initiatives.supports': 'Supports: {goal}',
  'initiatives.addPlaceholder': 'Add a task to this initiative',
  'initiatives.tasks': '{count} open',
  'initiatives.tasks_one': '1 open',
  'initiatives.tasks_other': '{count} open',
  'initiatives.empty': 'No initiatives yet. Add them on Manage.',
  'initiatives.emptyGroup': 'Nothing here.',
  'initiatives.noFilterMatches': 'No initiatives in this focus area.',
  'initiatives.completed': 'Completed',
  'initiatives.completedNone': 'Nothing completed in the last 90 days.',
  'initiatives.completedAt': 'Done {date}',
  'common.loading': 'Loading\u2026',

  // Goals & KPIs
  'goals.subtitle': 'Goals for {year} · {elapsed}% of the year gone · {left} days left',
  'goals.noActions': 'Nothing completed yet',
  'goals.thisWeekCount': '{count} actions this week (floor {floor})',
  'goals.thisWeekCount_one': '1 action this week (floor {floor})',
  'goals.thisWeekCount_other': '{count} actions this week (floor {floor})',
  'goals.lastAction': 'Last action {count} days ago',
  'goals.lastAction_one': 'Last action 1 day ago',
  'goals.lastAction_other': 'Last action {count} days ago',
  'goals.withoutNext': '{count} initiatives without a next action',
  'goals.withoutNext_one': '1 initiative without a next action',
  'goals.withoutNext_other': '{count} initiatives without a next action',
  'goals.next': 'Next: {task}',
  'goals.nothingOpen': 'Nothing open in this area',
  'goals.paceSummary': '{onTrack} on track · {atRisk} at risk · {behind} behind',
  'goals.empty': 'No goals yet. Add them on Manage.',
  'goals.emptyFocus': 'No goals in this focus area.',
  'goals.noKpis': 'No KPIs on this goal yet.',
  'goals.now': 'Now',
  'goals.target': 'target {target}{unit}',
  'goals.delta': '{delta}{unit} vs last month',
  'goals.noChange': 'No change',
  'goals.noDelta': 'Not enough history yet',
  'goals.linked': 'Linked initiatives',
  'goals.linkedNone': 'No initiatives linked yet.',
  'goals.clearFocus': 'Show every focus area',
  'goals.pace.reached': 'Reached',
  'goals.pace.onTrack': 'On track',
  'goals.pace.atRisk': 'At risk',
  'goals.pace.behind': 'Behind',
  'goals.expected': 'Expected by now',

  // Objectives
  'objectives.intro':
    'A few outcomes per day, week, month and quarter. Each one supports the level above it.',
  'objectives.cadence.d': 'Day',
  'objectives.cadence.w': 'Week',
  'objectives.cadence.m': 'Month',
  'objectives.cadence.q': 'Quarter',
  'objectives.previous': 'Previous period',
  'objectives.next': 'Next period',
  'objectives.backToToday': 'Back to today',
  'objectives.new': 'New objective',
  'objectives.capacity': '{open} open · {done} done · cap {cap}',
  'objectives.free': '{count} free',
  'objectives.free_one': '1 slot free',
  'objectives.free_other': '{count} slots free',
  'objectives.full': 'Full. That is the week accounted for.',
  'objectives.over': 'Over the cap of {cap}. Move one to keep the focus.',
  'objectives.empty': 'Nothing set for this period yet.',
  'objectives.supports': '{cadence}: {title}',
  'objectives.children': '{done} of {total} {cadence} objectives done',
  'objectives.moveOne': 'Move to {next}',
  'objectives.moveAll': 'Move {count} open to {next}',
  'objectives.moved': 'Moved to {next}.',
  'objectives.movedDropped': 'Moved to {next}. It no longer supports {parent}.',
  'objectives.titlePlaceholder': 'What is the outcome for this {cadence}?',
  'objectives.focus': 'Focus area',
  'objectives.focusNone': 'Customer delivery',
  'objectives.focusAdmin': 'Planning and admin',
  'objectives.parent': 'Supports',
  'objectives.parentNone': 'Nothing above it',
  'objectives.goal': 'Goal',
  'objectives.goalNone': 'No goal',
  'objectives.preview': 'Due {date}',
  'objectives.create': 'Add objective',
  'objectives.cancel': 'Cancel',
  'objectives.plan': 'Plan',
  'objectives.review': 'Review',
  'objectives.notes': 'Notes',
  'objectives.notesPlaceholder': 'What matters this period, and what came of it.',
  'objectives.recovered': 'Completed earlier',
  'initiatives.summary.active': '{count} active initiatives',
  'initiatives.summary.active_one': '1 active initiative',
  'initiatives.summary.active_other': '{count} active initiatives',
  'initiatives.summary.blocked': '{count} blocked',
  'initiatives.summary.noNext': '{count} without a next action',
  'initiatives.summary.noNext_one': '1 without a next action',
  'initiatives.summary.noNext_other': '{count} without a next action',
} as const;

export type ExtKey = keyof typeof EN;

/** French is optional: a key left out falls back to the English one. */
const FR: Partial<Record<ExtKey, string>> = {};

export type TxValues = Record<string, string | number>;

/**
 * Looks up one of the fork's strings and fills in its placeholders.
 *
 * A key given a `count` uses its `_one` / `_other` pair when there is one,
 * which is all the plural handling English needs — the same rule upstream's
 * `translate` follows, so the two behave alike.
 */
export function tx(locale: Locale, key: ExtKey, values?: TxValues): string {
  const dictionary = locale === 'fr' ? FR : undefined;
  let template: string = dictionary?.[key] ?? EN[key];

  if (values && typeof values.count === 'number') {
    const plural = `${key}${values.count === 1 ? '_one' : '_other'}`;
    const pluralised = (dictionary as Record<string, string> | undefined)?.[plural]
      ?? (EN as Record<string, string>)[plural];
    if (pluralised) template = pluralised;
  }

  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    (name in values ? String(values[name]) : match));
}

/** The translator, bound to the language the user chose (mirrors `useT`). */
export function useTx() {
  const locale = useStore((s) => s.prefs.locale);
  const translate = useCallback(
    (key: ExtKey, values?: TxValues) => tx(locale, key, values),
    [locale],
  );
  return { tx: translate, locale };
}

/**
 * The name the app's header and dialogs use for one of our pages.
 *
 * Read outside React so the hook in `App.tsx` stays a single line; the memo it
 * sits in already recomputes when the language changes.
 */
export function extContextLabel(view: ExtViewId): string {
  return tx(useStore.getState().prefs.locale, `page.${view}.title`);
}
