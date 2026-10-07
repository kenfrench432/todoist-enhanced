import { useMemo, useState } from 'react';
import { Select } from '@/components/Select';
import { toApiDate } from '@/domain/dates';
import type { Item } from '@/domain/types';
import { useData } from '@/hooks/useData';
import { useToday } from '@/hooks/useToday';
import { useStore } from '@/store/store';
import { linkInitiativeGoal, setSettings } from '@/ext/data/actions';
import { useExt } from '@/ext/data/store';
import type { ExtData, FocusArea } from '@/ext/data/types';
import {
  INITIATIVE_STATUSES, STATUS_LABELS, STATUS_ORDER, focusAreaIdOf, focusSlugOf,
  initiativesIn, labelsForInitiative, readInitiative, type InitiativeStatus,
} from '@/ext/domain/initiatives';
import {
  TARGET_CHOICES, TARGET_LABELS, targetDeadline, type TargetChoice,
} from '@/ext/domain/manage';
import { useTx } from '@/ext/i18n';
import { DraftInput, ProjectField, TwoStepRemove } from './parts';

export function InitiativesTab({ data, items }: { data: ExtData; items: Item[] }) {
  const { tx } = useTx();
  const { childrenOf } = useData();
  const update = useExt((state) => state.update);
  const prefix = data.settings.labels.focusPrefix;

  const initiatives = useMemo(
    () => initiativesIn(items, data.settings),
    [items, data.settings],
  );

  /* Grouped by focus area, with anything unfiled last: an initiative whose
     area was deleted still has to be reachable. */
  const groups = useMemo(() => {
    const areaOf = (task: Item) =>
      focusAreaIdOf(readInitiative(task, data.settings).focus, data.focusAreas, prefix);
    const byFocus: Array<{ area: FocusArea | null; tasks: Item[] }> = data.focusAreas.map(
      (area) => ({ area, tasks: initiatives.filter((task) => areaOf(task) === area.id) }),
    );
    const rest = initiatives.filter((task) => areaOf(task) === null);
    return rest.length > 0 ? [...byFocus, { area: null, tasks: rest }] : byFocus;
  }, [initiatives, data.focusAreas, data.settings, prefix]);

  return (
    <div className="ext-tab">
      <ProjectField
        label={tx('manage.initiatives.where')}
        value={data.settings.initiativesProjectId}
        onChange={(projectId) =>
          update((current) => setSettings(current, { initiativesProjectId: projectId }))}
      />

      {initiatives.length === 0 && <p className="empty">{tx('manage.initiatives.emptyAll')}</p>}

      {groups.map((group) => (
        <section className="ext-group" key={group.area?.id ?? 'none'}>
          <h2 className="ext-grouptitle">
            {group.area?.name ?? tx('manage.goals.noFocus')}
            <span className="ext-count">{group.tasks.length}</span>
          </h2>
          {group.tasks.length === 0
            ? <p className="ext-hint">{tx('manage.initiatives.empty')}</p>
            : group.tasks.map((task) => (
              <InitiativeCard
                key={task.id}
                task={task}
                data={data}
                subtasks={childrenOf(task.id)}
              />
            ))}
        </section>
      ))}

      <NewInitiative data={data} />
    </div>
  );
}

/** One initiative, bound to its Todoist task: every control writes through. */
function InitiativeCard(
  { task, data, subtasks }: { task: Item; data: ExtData; subtasks: Item[] },
) {
  const { tx } = useTx();
  const today = useToday();
  const update = useExt((state) => state.update);
  const updateTask = useStore((s) => s.updateTask);
  const setTaskLabels = useStore((s) => s.setTaskLabels);
  const toggleTask = useStore((s) => s.toggleTask);

  const prefix = data.settings.labels.focusPrefix;
  const read = readInitiative(task, data.settings);
  const focusId = focusAreaIdOf(read.focus, data.focusAreas, prefix) ?? '';
  const open = subtasks.filter((child) => !child.checked).length;
  const done = subtasks.length - open;

  const focusOptions = [
    ...data.focusAreas.map((area) => ({ value: area.id, label: area.name, marker: area.color })),
    { value: '', label: tx('manage.goals.noFocus') },
  ];
  const goalOptions = [
    { value: '', label: tx('manage.initiatives.noGoal') },
    ...data.goals.map((goal) => ({ value: goal.id, label: goal.title })),
  ];

  return (
    <article className="card ext-initiative">
      <DraftInput
        className="ext-title"
        value={task.content}
        ariaLabel={tx('manage.initiatives.namePlaceholder')}
        onCommit={(content) => void updateTask(task.id, { content })}
      />

      <div className="ext-initcontrols">
        <Select
          label={tx('manage.goals.focus')}
          value={focusId}
          options={focusOptions}
          onChange={(value) => void setTaskLabels(
            task.id,
            labelsForInitiative(task.labels, data.settings, {
              focus: value ? focusSlugOf(value, data.focusAreas, prefix) : null,
            }),
          )}
        />
        <Select
          label={tx('manage.initiatives.status')}
          value={read.status}
          options={STATUS_ORDER.map((status) => ({ value: status, label: STATUS_LABELS[status] }))}
          onChange={(value) => void setTaskLabels(
            task.id,
            labelsForInitiative(task.labels, data.settings, {
              status: value as InitiativeStatus,
            }),
          )}
        />
        <Select
          label={tx('manage.initiatives.target')}
          value="keep"
          options={TARGET_CHOICES.map((choice) => ({
            value: choice,
            label: choice === 'keep' && read.target ? toApiDate(read.target) : TARGET_LABELS[choice],
          }))}
          onChange={(value) => {
            const deadline = targetDeadline(value as TargetChoice, today);
            if (deadline === undefined) return; // "Keep" changes nothing
            void updateTask(task.id, {
              deadline: deadline ? { date: deadline, lang: 'en' } : null,
            });
          }}
        />
        <Select
          label={tx('manage.initiatives.goal')}
          value={data.initiativeGoals[task.id] ?? ''}
          options={goalOptions}
          onChange={(value) =>
            update((current) => linkInitiativeGoal(current, task.id, value || null))}
        />
      </div>

      {/* Only when it is blocked: a field for a reason nobody is giving is
          one more thing to read past. */}
      {read.status === 'blocked' && (
        <div className="ext-blocked">
          <span className="fieldlabel">{tx('manage.initiatives.blockedOn')}</span>
          <DraftInput
            value={read.blockedReason ?? ''}
            ariaLabel={tx('manage.initiatives.blockedOn')}
            placeholder={tx('manage.initiatives.blockedPlaceholder')}
            parse={(text) => text.trim()}
            onCommit={(reason) => {
              /* The reason is the first line of the description, so whatever
                 else is written there survives being given one. */
              const rest = task.description.split('\n').slice(1).join('\n');
              void updateTask(task.id, { description: `${reason}\n${rest}`.trimEnd() });
            }}
          />
        </div>
      )}

      <div className="ext-initfoot">
        <span className="ext-hint">{tx('manage.initiatives.tasks', { open, done })}</span>
        {/* Completing, never deleting: an initiative that is over is done. */}
        <TwoStepRemove onRemove={() => void toggleTask(task.id)} />
      </div>
      <p className="ext-hint ext-quiet">{tx('manage.initiatives.removeHint')}</p>
    </article>
  );
}

function NewInitiative({ data }: { data: ExtData }) {
  const { tx } = useTx();
  const today = useToday();
  const { snapshot } = useData();
  const createTask = useStore((s) => s.createTask);
  const toast = useStore((s) => s.toast);

  const [name, setName] = useState('');
  const [focus, setFocus] = useState(data.focusAreas[0]?.id ?? '');
  const [status, setStatus] = useState<InitiativeStatus>('planned');
  const [target, setTarget] = useState<TargetChoice>('none');

  const prefix = data.settings.labels.focusPrefix;
  const labels = labelsForInitiative([], data.settings, {
    focus: focus ? focusSlugOf(focus, data.focusAreas, prefix) : null,
    status,
  });

  const create = async () => {
    const content = name.trim();
    if (!content) return;
    const deadline = targetDeadline(target, today);
    await createTask({
      content,
      project_id: data.settings.initiativesProjectId ?? snapshot.user?.inbox_project_id,
      labels,
      ...(deadline ? { deadline: { date: deadline, lang: 'en' } } : {}),
    });
    setName('');
    toast(tx('manage.initiatives.created'));
  };

  const chips = <T extends string>(
    values: readonly T[], current: T, onPick: (value: T) => void, labelOf: (value: T) => string,
  ) => (
    <div className="chiprow ext-focuschips">
      {values.map((value) => (
        <button
          key={value}
          className="chip"
          aria-pressed={current === value}
          onClick={() => onPick(value)}
        >
          {labelOf(value)}
        </button>
      ))}
    </div>
  );

  return (
    <section className="card ext-newinit">
      <h2 className="ext-cardtitle">{tx('manage.initiatives.new')}</h2>
      <div className="ext-addrow">
        <input
          className="textfield"
          placeholder={tx('manage.initiatives.namePlaceholder')}
          aria-label={tx('manage.initiatives.new')}
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter') void create(); }}
        />
        <button className="btn primary" disabled={!name.trim()} onClick={() => void create()}>
          {tx('manage.initiatives.create')}
        </button>
      </div>

      {chips(
        data.focusAreas.map((area) => area.id), focus, setFocus,
        (id) => data.focusAreas.find((area) => area.id === id)?.short ?? id,
      )}
      {chips(
        INITIATIVE_STATUSES.filter((s) => s !== 'blocked' && s !== 'done'),
        status, setStatus, (value) => STATUS_LABELS[value],
      )}
      {chips(
        TARGET_CHOICES.filter((c) => c !== 'keep'), target, setTarget,
        (value) => TARGET_LABELS[value],
      )}

      {/* What it will carry, before it exists rather than after. */}
      <p className="ext-hint">
        {tx('manage.initiatives.labelsPreview')}{' '}
        {labels.map((label) => <code className="ext-labelchip" key={label}>@{label}</code>)}
      </p>
    </section>
  );
}
