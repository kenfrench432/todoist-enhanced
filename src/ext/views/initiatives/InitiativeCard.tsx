import { useState } from 'react';
import { Icon } from '@/components/Icon';
import { TaskRow } from '@/components/TaskRow';
import { markerStyle } from '@/domain/colors';
import { toApiDate } from '@/domain/dates';
import type { Item } from '@/domain/types';
import { navigate } from '@/hooks/useRoute';
import { useStore } from '@/store/store';
import type { ExtData, FocusArea } from '@/ext/data/types';
import {
  STATUS_LABELS, STATUS_TONES, initiativeProgress, initiativeWarnings,
  labelsForInitiative, lastDoneAt, readInitiative,
} from '@/ext/domain/initiatives';
import { useTx } from '@/ext/i18n';

const TONE_COLORS: Record<string, string> = {
  blue: 'blue', green: 'green', amber: 'orange', red: 'red', gray: 'charcoal',
};

/**
 * One initiative: what it is, what is wrong with it, how far along, and the
 * tasks inside it.
 *
 * Sub-task rows are upstream's `TaskRow`, so ticking one off here is the same
 * act as ticking it off anywhere else.
 */
export function InitiativeCard({
  task, subtasks, childrenOf, onOpen, data, area, now,
}: {
  task: Item;
  subtasks: Item[];
  childrenOf: (id: string) => Item[];
  onOpen: (id: string) => void;
  data: ExtData;
  area: FocusArea | undefined;
  now: Date;
}) {
  const { tx } = useTx();
  const createTask = useStore((s) => s.createTask);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');

  const read = readInitiative(task, data.settings);
  const progress = initiativeProgress(subtasks);
  const warnings = initiativeWarnings(read, subtasks, now, lastDoneAt(subtasks));
  const goal = data.goals.find((entry) => entry.id === data.initiativeGoals[task.id]);
  const openTasks = subtasks.filter((child) => !child.checked);

  /* A task added here belongs to this initiative, so it carries the same
     labels: the focus area and status it is part of. */
  const add = async () => {
    const content = draft.trim();
    if (!content) return;
    await createTask({
      content,
      parent_id: task.id,
      labels: labelsForInitiative([], data.settings, {
        focus: read.focus, status: read.status,
      }),
    });
    setDraft('');
  };

  return (
    <article className="card ext-initcard">
      <div className="ext-initcardhead">
        <Icon name="board" className="ext-initicon" style={markerStyle(area?.color ?? 'charcoal')} />
        <span className="ext-initname">{task.content}</span>
        {area && (
          <span className="chip ext-focuschip" style={markerStyle(area.color)}>{area.short}</span>
        )}
        <span
          className="chip ext-statuschip"
          style={markerStyle(TONE_COLORS[STATUS_TONES[read.status]] ?? 'charcoal')}
        >
          {STATUS_LABELS[read.status]}
        </span>
        {read.target && (
          <span className="chip ext-deadline">
            <Icon name="deadline" size="sm" />
            {toApiDate(read.target)}
          </span>
        )}
      </div>

      {warnings.length > 0 && (
        <ul className="ext-warnings">
          {warnings.map((warning) => (
            <li className={`ext-warning ${warning.tone}`} key={warning.text}>
              <Icon name="warning" size="sm" />
              {warning.text}
            </li>
          ))}
        </ul>
      )}

      <div className="ext-initmeta">
        {progress.total > 0 && (
          <>
            <div className="ext-progress" role="presentation">
              <span style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }} />
            </div>
            <span className="ext-hint">
              {tx('customers.progress', { done: progress.done, total: progress.total })}
            </span>
          </>
        )}
        {goal && (
          <button
            className="btn sm quiet ext-goallink"
            onClick={() => navigate('goals', area?.id)}
          >
            {tx('initiatives.supports', { goal: goal.title })}
          </button>
        )}
        <button
          className="btn sm quiet"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          <Icon name={open ? 'caret-up' : 'caret'} size="sm" />
          {tx('initiatives.tasks', { count: openTasks.length })}
        </button>
      </div>

      {open && (
        <div className="ext-subtasks">
          {subtasks.map((child) => (
            <TaskRow
              key={child.id}
              item={child}
              childrenOf={childrenOf}
              onOpen={onOpen}
              showProject={false}
            />
          ))}
          <div className="ext-addrow">
            <input
              className="textfield"
              placeholder={tx('initiatives.addPlaceholder')}
              aria-label={`${tx('initiatives.addPlaceholder')} — ${task.content}`}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') void add(); }}
            />
            <button className="btn sm" disabled={!draft.trim()} onClick={() => void add()}>
              {tx('manage.add')}
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
