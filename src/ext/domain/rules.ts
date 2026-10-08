import { hasLabel } from '@/domain/views';
import type { Item } from '@/domain/types';

/**
 * Tidy-up rules: "tasks like this should look like that".
 *
 * Deliberately not an automation engine. Nothing here writes anything — these
 * work out what *would* change, and the page shows it for approval. A rule
 * that applied itself would fight you the moment you deliberately parked a
 * task somewhere it says it should not be.
 */

export interface Rule {
  id: string;
  /** Off without being deleted. */
  on: boolean;
  when: {
    /** Null means any project. The Inbox is a project like any other. */
    projectId: string | null;
    hasLabel: string | null;
  };
  then: {
    addLabel: string | null;
    moveToProjectId: string | null;
  };
}

export const emptyRule = (id: string): Rule => ({
  id,
  on: true,
  when: { projectId: null, hasLabel: null },
  then: { addLabel: null, moveToProjectId: null },
});

/**
 * A rule with nothing to match on, or nothing to do, is not ready.
 *
 * Without the first half a rule would claim every task in the account, which
 * is the one mistake here that is expensive to undo.
 */
export const ruleReady = (rule: Rule): boolean =>
  (rule.when.projectId !== null || rule.when.hasLabel !== null)
  && (rule.then.addLabel !== null || rule.then.moveToProjectId !== null);

export interface Change {
  item: Item;
  /** Labels to add, none of which the task already carries. */
  addLabels: string[];
  /** Where it should go, when that is somewhere other than where it is. */
  moveTo: string | null;
  /** The rules that asked, so the page can say why. */
  byRules: string[];
}

const matches = (item: Item, rule: Rule): boolean => {
  if (rule.when.projectId !== null && item.project_id !== rule.when.projectId) return false;
  if (rule.when.hasLabel !== null && !hasLabel(item, rule.when.hasLabel)) return false;
  return true;
};

/**
 * What the rules would change about one task, or null when it already looks
 * the way they want.
 *
 * A sub-task is never moved: in Todoist it lives with its parent, and moving
 * it would pull it out of the task it belongs to — a bigger change than any
 * tidy-up rule should be making on its own.
 */
export function changeFor(item: Item, rules: Rule[]): Change | null {
  if (item.checked || item.is_deleted) return null;

  const addLabels: string[] = [];
  let moveTo: string | null = null;
  const byRules: string[] = [];

  for (const rule of rules) {
    if (!rule.on || !ruleReady(rule) || !matches(item, rule)) continue;
    let asked = false;

    const label = rule.then.addLabel;
    if (label && !hasLabel(item, label) && !addLabels.includes(label)) {
      addLabels.push(label);
      asked = true;
    }

    const target = rule.then.moveToProjectId;
    if (target && target !== item.project_id && !item.parent_id && moveTo === null) {
      moveTo = target;
      asked = true;
    }

    if (asked) byRules.push(rule.id);
  }

  if (addLabels.length === 0 && moveTo === null) return null;
  return { item, addLabels, moveTo, byRules };
}

/** Everything the rules would change, one entry per task. */
export const pendingChanges = (items: Item[], rules: Rule[]): Change[] =>
  items.map((item) => changeFor(item, rules)).filter((change): change is Change => change !== null);

/** The labels a task ends up with, for the write. */
export const labelsAfter = (change: Change): string[] =>
  [...change.item.labels, ...change.addLabels];

/** Changes grouped by where they are going, so one move covers many tasks. */
export function movesByProject(changes: Change[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const change of changes) {
    if (!change.moveTo) continue;
    const bucket = out.get(change.moveTo) ?? [];
    bucket.push(change.item.id);
    out.set(change.moveTo, bucket);
  }
  return out;
}
