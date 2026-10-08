import { hasLabel } from '@/domain/views';
import type { Item, Snapshot } from '@/domain/types';
import type { Customer, ExtSettings, FocusArea } from '@/ext/data/types';

/**
 * Reading and writing the labels the fork's meaning rides on.
 *
 * Todoist has no fields for any of this, so a label is the carrier: a customer
 * is a label, a focus area is a label, an initiative's status is a label. These
 * are the rules for putting one on and taking one off without disturbing the
 * rest of a task's labels.
 */

/** The customer label for a name: lowercase, with runs of anything else as `-`. */
export const slug = (name: string): string =>
  name.normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/**
 * Whether a label is one the fork puts there itself.
 *
 * Manage uses this to show the labels that are *not* accounted for — a label
 * that is neither a marker nor a registered customer is probably a customer
 * nobody has registered yet.
 */
export function isMarkerLabel(label: string, settings: ExtSettings): boolean {
  const name = label.toLowerCase();
  const { engagement, initiative, objective, periodPrefix, focusPrefix, statusPrefix } =
    settings.labels;
  if ([engagement, initiative, objective].some((marker) => marker.toLowerCase() === name)) {
    return true;
  }
  return [periodPrefix, focusPrefix, statusPrefix]
    .some((prefix) => prefix && name.startsWith(prefix.toLowerCase()));
}

/**
 * Every registered customer label on a task.
 *
 * Normally one. Two means the task is claimed by two customers, which the
 * Customers page shows under both with a warning — rather than silently
 * picking one and leaving the other wondering where its task went.
 */
export const customerLabelsOf = (item: Item, customers: Customer[]): string[] =>
  customers.filter((customer) => customer.label && hasLabel(item, customer.label))
    .map((customer) => customer.label);

/** The task's customer label, or null when it has none or more than one. */
export function customerLabelOf(item: Item, customers: Customer[]): string | null {
  const found = customerLabelsOf(item, customers);
  return found.length === 1 ? found[0] : null;
}

/**
 * Sets the one label with this prefix, leaving every other label alone.
 *
 * Changing an initiative's status or focus area is exactly this: the old
 * `status-*` comes off as the new one goes on, in a single edit, so a task can
 * never end up carrying two statuses. A null value removes the label without
 * adding one.
 *
 * The order of the labels that stay is preserved, and the new one goes on the
 * end, so a task's labels do not reshuffle every time a select is touched.
 */
export function swapPrefixedLabel(
  labels: string[], prefix: string, value: string | null,
): string[] {
  const lower = prefix.toLowerCase();
  const kept = labels.filter((label) => !label.toLowerCase().startsWith(lower));
  if (value === null) return kept;
  const next = value.toLowerCase().startsWith(lower) ? value : `${prefix}${value}`;
  return kept.some((label) => label.toLowerCase() === next.toLowerCase())
    ? kept
    : [...kept, next];
}

/* ---------- Choosing which Todoist label a thing means ---------- */

export interface LabelChoice {
  name: string;
  /** Todoist has no label by this name — offer to create it. */
  missing: boolean;
}

const realLabels = (snapshot: Snapshot): string[] =>
  Object.values(snapshot.labels)
    .filter((label) => !label.is_deleted && !label.name.startsWith('est-'))
    .map((label) => label.name);

/**
 * Always offers what is already chosen, even when Todoist has no such label.
 *
 * A fresh document points its focus areas at labels the account has never had,
 * and a picker that silently dropped the current value would read as having
 * lost the setting.
 */
function withCurrent(names: string[], current: string): LabelChoice[] {
  const seen = new Set(names.map((name) => name.toLowerCase()));
  const choices = names.sort((a, b) => a.localeCompare(b))
    .map((name) => ({ name, missing: false }));
  if (current && !seen.has(current.toLowerCase())) {
    choices.unshift({ name: current, missing: true });
  }
  return choices;
}

/**
 * The labels a customer can be pointed at.
 *
 * Marker labels are out — a customer whose label was `engagement` would claim
 * every engagement in the account — and so is any label another customer
 * already means, because one label belongs to one customer.
 */
export function customerLabelChoices(
  snapshot: Snapshot,
  settings: ExtSettings,
  customers: Customer[],
  selfId: string,
): LabelChoice[] {
  const taken = new Set(
    customers.filter((customer) => customer.id !== selfId)
      .map((customer) => customer.label.toLowerCase()),
  );
  const current = customers.find((customer) => customer.id === selfId)?.label ?? '';
  return withCurrent(
    realLabels(snapshot)
      .filter((name) => !isMarkerLabel(name, settings))
      .filter((name) => !taken.has(name.toLowerCase())),
    current,
  );
}

/**
 * The labels a focus area can be pointed at: the ones carrying the focus
 * prefix, which is what makes them focus labels in the first place.
 */
export function focusLabelChoices(
  snapshot: Snapshot,
  settings: ExtSettings,
  areas: FocusArea[],
  selfId: string,
): LabelChoice[] {
  const prefix = settings.labels.focusPrefix.toLowerCase();
  const taken = new Set(
    areas.filter((area) => area.id !== selfId).map((area) => area.label.toLowerCase()),
  );
  const current = areas.find((area) => area.id === selfId)?.label ?? '';
  return withCurrent(
    realLabels(snapshot)
      .filter((name) => prefix && name.toLowerCase().startsWith(prefix))
      .filter((name) => !taken.has(name.toLowerCase())),
    current,
  );
}

/**
 * Every label a rule could sensibly name.
 *
 * Todoist's own labels, plus any label actually sitting on a task. The second
 * half matters because the fork invents labels — `focus-…`, `status-…`, a
 * customer slug — and a document can be pointing at one before the account
 * has it. A rule that cannot name a label the app can plainly see on a task
 * would read as broken, so the list follows what is there rather than what is
 * registered.
 *
 * `est-<minutes>` is left out on both sides: those are upstream's estimates,
 * not labels anyone files by, and there can be dozens.
 */
export function ruleLabelChoices(snapshot: Snapshot, items: Item[]): string[] {
  const names = new Map<string, string>();
  const offer = (name: string) => {
    if (!name || name.startsWith('est-')) return;
    if (!names.has(name.toLowerCase())) names.set(name.toLowerCase(), name);
  };

  for (const name of realLabels(snapshot)) offer(name);
  for (const item of items) for (const name of item.labels) offer(name);

  return [...names.values()].sort((a, b) => a.localeCompare(b));
}
