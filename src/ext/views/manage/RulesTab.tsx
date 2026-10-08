import { useMemo, useState } from 'react';
import { Icon } from '@/components/Icon';
import { Select, type SelectOption } from '@/components/Select';
import type { Item, Snapshot } from '@/domain/types';
import { useStore } from '@/store/store';
import { addRule, removeRule, updateRule } from '@/ext/data/actions';
import { useExt } from '@/ext/data/store';
import type { ExtData } from '@/ext/data/types';
import { ruleLabelChoices } from '@/ext/domain/labels';
import { pickableProjects } from '@/ext/domain/projects';
import {
  labelsAfter, movesByProject, pendingChanges, ruleReady, type Change, type Rule,
} from '@/ext/domain/rules';
import { useTx } from '@/ext/i18n';
import { TwoStepRemove } from './parts';

/**
 * Rules, and what they would change.
 *
 * The two live in one tab because they are one thought: editing a rule changes
 * the list underneath it straight away, and nothing is written until the
 * button at the bottom is pressed. That is the whole design — a task parked
 * somewhere on purpose stays there, because no rule ever runs on its own.
 */
export function RulesTab(
  { data, snapshot, items }: { data: ExtData; snapshot: Snapshot; items: Item[] },
) {
  const { tx } = useTx();
  const update = useExt((state) => state.update);
  const updateMany = useStore((s) => s.updateMany);
  const moveMany = useStore((s) => s.moveMany);

  /* Held by exception rather than by selection: a change the rules find is
     wanted unless it is waved off, and the list changes under you as rules
     are edited. */
  const [waved, setWaved] = useState<string[]>([]);

  const changes = useMemo(() => pendingChanges(items, data.rules), [items, data.rules]);
  const chosen = changes.filter((change) => !waved.includes(change.item.id));

  const inbox = snapshot.user?.inbox_project_id;
  const projectName = (id: string | null): string => {
    if (!id) return tx('manage.rules.anyProject');
    if (id === inbox) return tx('manage.inbox');
    return snapshot.projects[id]?.name ?? id;
  };

  /* The Inbox is a project like any other here: a task landing there is half
     of what Ken asked for, so it has to be pickable. */
  const projectOptions: SelectOption[] = [
    { value: '', label: tx('manage.rules.anyProject') },
    ...(inbox ? [{ value: inbox, label: tx('manage.inbox'), icon: 'inbox' as const }] : []),
    ...pickableProjects(snapshot.projects, inbox)
      .map((project) => ({ value: project.id, label: project.name, marker: project.color })),
  ];

  const labelNames = useMemo(() => ruleLabelChoices(snapshot, items), [snapshot, items]);
  const labelOptions = (noneLabel: string): SelectOption[] => [
    { value: '', label: noneLabel },
    ...labelNames.map((name) => ({ value: name, label: `@${name}` })),
  ];

  /**
   * The only writes this tab makes.
   *
   * Labels go in one request; moves go one per destination, because
   * `item_move` takes one. Each request carries its own toast and its own
   * undo, which is the app's rule everywhere else — a tidy that labelled four
   * tasks and moved two can be taken back a part at a time.
   *
   * `moveMany` lifts a sub-task out from under its parent, which is why
   * `changeFor` never puts one in a move.
   */
  const apply = async () => {
    const labelled = chosen.filter((change) => change.addLabels.length > 0);
    if (labelled.length > 0) {
      const after = new Map(labelled.map((change) => [change.item.id, labelsAfter(change)]));
      await updateMany(
        labelled.map((change) => change.item.id),
        (item) => ({ labels: after.get(item.id) ?? item.labels }),
        tx('manage.pending.labelled', { count: labelled.length }),
      );
    }
    for (const [projectId, ids] of movesByProject(chosen)) {
      await moveMany(ids, { project_id: projectId, section_id: null }, projectName(projectId));
    }
  };

  return (
    <div className="ext-tab">
      <section className="card">
        <h2 className="ext-cardtitle">
          {tx('manage.rules.title')}
          <span className="ext-count">{data.rules.length}</span>
        </h2>
        <p className="ext-hint">{tx('manage.rules.hint')}</p>

        {data.rules.length === 0 && <p className="ext-hint">{tx('manage.rules.none')}</p>}

        {data.rules.map((rule) => (
          <RuleRow
            key={rule.id}
            rule={rule}
            projectOptions={projectOptions}
            labelOptions={labelOptions}
            onChange={(fields) => update((current) => updateRule(current, rule.id, fields))}
            onRemove={() => update((current) => removeRule(current, rule.id))}
          />
        ))}

        <div className="ext-rulesfoot">
          <button className="btn sm" onClick={() => update((current) => addRule(current))}>
            <Icon name="plus" size="sm" />
            {tx('manage.rules.add')}
          </button>
        </div>
      </section>

      <section className="card">
        <h2 className="ext-cardtitle">
          {tx('manage.pending.title')}
          {changes.length > 0 && (
            <span className="ext-count">
              {tx('manage.pending.count', { count: changes.length })}
            </span>
          )}
        </h2>

        {changes.length === 0
          ? <p className="ext-hint">{tx('manage.pending.none')}</p>
          : (
            <>
              {changes.map((change) => (
                <label className="ext-pendingrow" key={change.item.id}>
                  <input
                    type="checkbox"
                    checked={!waved.includes(change.item.id)}
                    onChange={() => setWaved((current) => (
                      current.includes(change.item.id)
                        ? current.filter((id) => id !== change.item.id)
                        : [...current, change.item.id]
                    ))}
                  />
                  <span className="ext-pendingtitle">{change.item.content}</span>
                  <span className="ext-hint">{describe(change, projectName, tx)}</span>
                </label>
              ))}

              <div className="ext-rulesfoot">
                <button
                  className="btn primary"
                  disabled={chosen.length === 0}
                  onClick={() => void apply()}
                >
                  {tx('manage.pending.apply', { count: chosen.length })}
                </button>
              </div>
            </>
          )}
      </section>
    </div>
  );
}

/** What one change would do, in the order it would happen. */
function describe(
  change: Change,
  projectName: (id: string | null) => string,
  tx: ReturnType<typeof useTx>['tx'],
): string {
  const parts = [
    projectName(change.item.project_id),
    ...change.addLabels.map((label) => tx('manage.pending.addLabel', { label })),
    ...(change.moveTo
      ? [tx('manage.pending.moveTo', { project: projectName(change.moveTo) })]
      : []),
  ];
  return parts.join(' · ');
}

/**
 * One rule, read as a sentence.
 *
 * A rule with no condition would claim every task in the account, so it says
 * what it is missing rather than quietly matching everything; `ruleReady`
 * keeps it out of the list underneath either way.
 */
function RuleRow({ rule, projectOptions, labelOptions, onChange, onRemove }: {
  rule: Rule;
  projectOptions: SelectOption[];
  labelOptions: (noneLabel: string) => SelectOption[];
  onChange: (fields: Partial<Rule>) => void;
  onRemove: () => void;
}) {
  const { tx } = useTx();
  const ready = ruleReady(rule);

  return (
    <div className={`ext-rulerow${rule.on ? '' : ' ext-ruleoff'}`}>
      <button
        type="button"
        className="switch"
        role="switch"
        aria-checked={rule.on}
        aria-label={tx('manage.rules.toggle')}
        onClick={() => onChange({ on: !rule.on })}
      />

      <div className="ext-rulesentence">
        <span className="ext-ruleword">{tx('manage.rules.when')}</span>
        <Select
          ariaLabel={tx('manage.rules.when')}
          value={rule.when.projectId ?? ''}
          options={projectOptions}
          onChange={(value) => onChange({ when: { ...rule.when, projectId: value || null } })}
        />
        <span className="ext-ruleword">{tx('manage.rules.andHas')}</span>
        <Select
          ariaLabel={tx('manage.rules.andHas')}
          value={rule.when.hasLabel ?? ''}
          options={labelOptions(tx('manage.rules.anyLabel'))}
          onChange={(value) => onChange({ when: { ...rule.when, hasLabel: value || null } })}
        />
        <span className="ext-ruleword">{tx('manage.rules.thenLabel')}</span>
        <Select
          ariaLabel={tx('manage.rules.thenLabel')}
          value={rule.then.addLabel ?? ''}
          options={labelOptions(tx('manage.rules.noLabel'))}
          onChange={(value) => onChange({ then: { ...rule.then, addLabel: value || null } })}
        />
        <span className="ext-ruleword">{tx('manage.rules.thenMove')}</span>
        <Select
          ariaLabel={tx('manage.rules.thenMove')}
          value={rule.then.moveToProjectId ?? ''}
          options={projectOptions.map((option) => (
            option.value === '' ? { ...option, label: tx('manage.rules.noMove') } : option
          ))}
          onChange={(value) =>
            onChange({ then: { ...rule.then, moveToProjectId: value || null } })}
        />
        {!ready && <p className="ext-error">{tx('manage.rules.incomplete')}</p>}
      </div>

      <TwoStepRemove onRemove={onRemove} />
    </div>
  );
}
