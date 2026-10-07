import { useState } from 'react';
import { Select } from '@/components/Select';
import { dueDate } from '@/domain/dates';
import type { Item } from '@/domain/types';
import { useData } from '@/hooks/useData';
import { useStore } from '@/store/store';
import { linkObjective, linkObjectiveGoal } from '@/ext/data/actions';
import { useExt } from '@/ext/data/store';
import type { ExtData } from '@/ext/data/types';
import { focusSlugOf } from '@/ext/domain/initiatives';
import { dueForPeriod, labelsForObjective } from '@/ext/domain/objectives';
import { parentCandidates, type Cadence } from '@/ext/domain/periods';
import { useTx, type ExtKey } from '@/ext/i18n';

/**
 * The form that adds an objective to the period on screen.
 *
 * It shows the labels and the due date before anything is created: the due
 * date is the **last day** of the period, which is what makes an objective
 * show up in a plain Todoist view on the day it has to be true by.
 */
export function NewObjective({
  data, cadence, offset, now, above, onDone,
}: {
  data: ExtData;
  cadence: Cadence;
  offset: number;
  now: Date;
  /** Every objective a level up, for the "Supports" select. */
  above: Item[];
  onDone: () => void;
}) {
  const { tx } = useTx();
  const { snapshot } = useData();
  const createTask = useStore((s) => s.createTask);

  const [title, setTitle] = useState('');
  const [focus, setFocus] = useState('');
  const [parent, setParent] = useState('');
  const [goal, setGoal] = useState('');

  const prefix = data.settings.labels.focusPrefix;
  const dueOn = dueForPeriod(cadence, offset, now);
  const labels = labelsForObjective([], data.settings, {
    cadence,
    focus: focus ? focusSlugOf(focus, data.focusAreas, prefix) : null,
  });

  /* Only the objectives whose period actually contains this one's start can
     be its parent — a week starting in October cannot support September. */
  const candidates = parentCandidates(above, (item) => dueDate(item), cadence, offset, now);

  const create = async () => {
    const content = title.trim();
    if (!content) return;

    /* createTask gives nothing back, so the new task is found by what the
       snapshot gained. It arrives under a temporary id; the ext store follows
       it to its real one when Todoist answers (`remapTaskIds`), so a link made
       now does not end up naming an id that has stopped existing. */
    const before = new Set(Object.keys(useStore.getState().snapshot.items));
    await createTask({
      content,
      project_id: data.settings.objectivesProjectId ?? snapshot.user?.inbox_project_id,
      labels,
      due: { date: dueOn },
    });
    const id = Object.keys(useStore.getState().snapshot.items).find((key) => !before.has(key));

    if (id && parent) useExt.getState().update((c) => linkObjective(c, id, parent));
    if (id && goal) useExt.getState().update((c) => linkObjectiveGoal(c, id, goal));
    setTitle('');
    onDone();
  };

  return (
    <section className="card ext-newobjective">
      <div className="ext-addrow">
        <input
          className="textfield"
          autoFocus
          placeholder={tx('objectives.titlePlaceholder', {
            cadence: tx(`objectives.cadence.${cadence}` as ExtKey).toLowerCase(),
          })}
          aria-label={tx('objectives.new')}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void create();
            if (event.key === 'Escape') onDone();
          }}
        />
        <button className="btn primary" disabled={!title.trim()} onClick={() => void create()}>
          {tx('objectives.create')}
        </button>
        <button className="btn quiet" onClick={onDone}>{tx('objectives.cancel')}</button>
      </div>

      <div className="chiprow ext-composerchips">
        <button className="chip" aria-pressed={focus === ''} onClick={() => setFocus('')}>
          {tx('objectives.focusNone')}
        </button>
        {data.focusAreas.map((area) => (
          <button
            key={area.id}
            className="chip"
            aria-pressed={focus === area.id}
            onClick={() => setFocus(area.id)}
          >
            {area.short}
          </button>
        ))}
      </div>

      <div className="ext-objselects">
        {candidates.length > 0 && (
          <Select
            label={tx('objectives.parent')}
            value={parent}
            options={[
              { value: '', label: tx('objectives.parentNone') },
              ...candidates.map((item) => ({ value: item.id, label: item.content })),
            ]}
            onChange={setParent}
          />
        )}
        {/* A quarter is the level goals are set at, so only it offers one. */}
        {cadence === 'q' && data.goals.length > 0 && (
          <Select
            label={tx('objectives.goal')}
            value={goal}
            options={[
              { value: '', label: tx('objectives.goalNone') },
              ...data.goals.map((entry) => ({ value: entry.id, label: entry.title })),
            ]}
            onChange={setGoal}
          />
        )}
      </div>

      <p className="ext-hint">
        {tx('objectives.preview', { date: dueOn })}{' '}
        {labels.map((label) => <code className="ext-labelchip" key={label}>@{label}</code>)}
      </p>
    </section>
  );
}
