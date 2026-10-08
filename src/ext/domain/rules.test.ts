import { describe, expect, it } from 'vitest';
import { item } from '@/test/items';
import {
  changeFor, emptyRule, labelsAfter, movesByProject, pendingChanges, ruleReady, type Rule,
} from './rules';

const rule = (over: Partial<Rule['when']>, then: Partial<Rule['then']>, id = 'r1'): Rule => ({
  id,
  on: true,
  when: { projectId: null, hasLabel: null, ...over },
  then: { addLabel: null, moveToProjectId: null, ...then },
});

/** Ken's two: tasks in Engagements get the label; labelled Inbox tasks move. */
const LABEL_IT = rule({ projectId: 'engagements' }, { addLabel: 'engagement' }, 'label-it');
const MOVE_IT = rule({ projectId: 'inbox', hasLabel: 'engagement' }, { moveToProjectId: 'engagements' }, 'move-it');

describe('ruleReady', () => {
  /* Without a condition a rule claims every task in the account, which is the
     one mistake here that is expensive to undo. */
  it('refuses a rule with nothing to match on', () => {
    expect(ruleReady(rule({}, { addLabel: 'x' }))).toBe(false);
    expect(ruleReady(emptyRule('r'))).toBe(false);
  });

  it('refuses a rule with nothing to do', () => {
    expect(ruleReady(rule({ projectId: 'p' }, {}))).toBe(false);
  });

  it('accepts one with both', () => {
    expect(ruleReady(LABEL_IT)).toBe(true);
    expect(ruleReady(MOVE_IT)).toBe(true);
  });
});

describe('a task in the Engagements project', () => {
  it('is offered the label', () => {
    const task = item({ id: 't', project_id: 'engagements' });
    expect(changeFor(task, [LABEL_IT])).toMatchObject({
      addLabels: ['engagement'], moveTo: null, byRules: ['label-it'],
    });
  });

  /* Nothing to do is not a change: otherwise the panel lists every task in
     the project for ever. */
  it('is left alone once it already carries it', () => {
    const done = item({ id: 't', project_id: 'engagements', labels: ['engagement'] });
    expect(changeFor(done, [LABEL_IT])).toBeNull();
  });

  it('is left alone when the rule is switched off', () => {
    const task = item({ id: 't', project_id: 'engagements' });
    expect(changeFor(task, [{ ...LABEL_IT, on: false }])).toBeNull();
  });

  it('is left alone once it is done', () => {
    const task = item({ id: 't', project_id: 'engagements', checked: true });
    expect(changeFor(task, [LABEL_IT])).toBeNull();
  });
});

describe('a labelled task in the Inbox', () => {
  it('is offered the move', () => {
    const task = item({ id: 't', project_id: 'inbox', labels: ['engagement'] });
    expect(changeFor(task, [MOVE_IT])).toMatchObject({
      addLabels: [], moveTo: 'engagements', byRules: ['move-it'],
    });
  });

  it('is ignored without the label, and ignored elsewhere', () => {
    expect(changeFor(item({ id: 't', project_id: 'inbox' }), [MOVE_IT])).toBeNull();
    expect(changeFor(
      item({ id: 't', project_id: 'other', labels: ['engagement'] }), [MOVE_IT],
    )).toBeNull();
  });

  /* A sub-task lives with its parent; moving it would pull it out of the task
     it belongs to, which is a bigger change than a tidy-up should make. */
  it('is never moved when it is a sub-task', () => {
    const child = item({ id: 'c', project_id: 'inbox', parent_id: 'p', labels: ['engagement'] });
    expect(changeFor(child, [MOVE_IT])).toBeNull();
  });

  it('is left alone once it is already there', () => {
    const task = item({ id: 't', project_id: 'engagements', labels: ['engagement'] });
    expect(changeFor(task, [MOVE_IT])).toBeNull();
  });
});

describe('several rules on one task', () => {
  it('are gathered into a single change', () => {
    const both = rule({ projectId: 'inbox' }, { addLabel: 'engagement', moveToProjectId: 'engagements' }, 'both');
    const task = item({ id: 't', project_id: 'inbox' });
    const change = changeFor(task, [both]);
    expect(change).toMatchObject({ addLabels: ['engagement'], moveTo: 'engagements' });
  });

  it('never ask for the same label twice, and the first move wins', () => {
    const a = rule({ projectId: 'inbox' }, { addLabel: 'x', moveToProjectId: 'one' }, 'a');
    const b = rule({ projectId: 'inbox' }, { addLabel: 'x', moveToProjectId: 'two' }, 'b');
    const change = changeFor(item({ id: 't', project_id: 'inbox' }), [a, b]);
    expect(change?.addLabels).toEqual(['x']);
    expect(change?.moveTo).toBe('one');
  });

  it('records only the rules that actually asked for something', () => {
    const task = item({ id: 't', project_id: 'engagements', labels: ['engagement'] });
    // LABEL_IT has nothing to add, MOVE_IT does not match: no change at all.
    expect(changeFor(task, [LABEL_IT, MOVE_IT])).toBeNull();
  });
});

describe('the list the page applies', () => {
  const items = [
    item({ id: 'a', project_id: 'engagements' }),
    item({ id: 'b', project_id: 'inbox', labels: ['engagement'] }),
    item({ id: 'c', project_id: 'inbox', labels: ['engagement'] }),
    item({ id: 'tidy', project_id: 'engagements', labels: ['engagement'] }),
  ];

  it('has one entry per task that needs something', () => {
    expect(pendingChanges(items, [LABEL_IT, MOVE_IT]).map((c) => c.item.id))
      .toEqual(['a', 'b', 'c']);
  });

  it('is empty when nothing needs doing', () => {
    expect(pendingChanges([items[3]], [LABEL_IT, MOVE_IT])).toEqual([]);
    expect(pendingChanges(items, [])).toEqual([]);
  });

  it('keeps the labels a task already had', () => {
    const change = changeFor(item({ id: 't', project_id: 'engagements', labels: ['avon'] }), [LABEL_IT]);
    expect(labelsAfter(change!)).toEqual(['avon', 'engagement']);
  });

  /* One move command per destination rather than one per task. */
  it('groups the moves by where they are going', () => {
    const grouped = movesByProject(pendingChanges(items, [LABEL_IT, MOVE_IT]));
    expect([...grouped.entries()]).toEqual([['engagements', ['b', 'c']]]);
  });
});
