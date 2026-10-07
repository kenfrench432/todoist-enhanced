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
} as const;

export type ExtKey = keyof typeof EN;

/** French is optional: a key left out falls back to the English one. */
const FR: Partial<Record<ExtKey, string>> = {};

/** Looks up one of the fork's strings. Pure, so the rules can be tested. */
export function tx(locale: Locale, key: ExtKey): string {
  return (locale === 'fr' ? FR[key] : undefined) ?? EN[key];
}

/** The translator, bound to the language the user chose (mirrors `useT`). */
export function useTx() {
  const locale = useStore((s) => s.prefs.locale);
  const translate = useCallback((key: ExtKey) => tx(locale, key), [locale]);
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
