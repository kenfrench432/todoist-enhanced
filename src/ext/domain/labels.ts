import { hasLabel } from '@/domain/views';
import type { Item } from '@/domain/types';
import type { Customer, ExtSettings } from '@/ext/data/types';

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
