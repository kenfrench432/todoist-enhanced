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
  'manage.customers.moveUp': 'Move up',
  'manage.customers.moveDown': 'Move down',
  'manage.customers.tone': 'Change the colour',

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
