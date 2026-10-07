import { Icon } from '@/components/Icon';
import { markerStyle } from '@/domain/colors';
import type { Item } from '@/domain/types';
import { useStore } from '@/store/store';
import { linkObjective } from '@/ext/data/actions';
import { useExt } from '@/ext/data/store';
import type { ExtData } from '@/ext/data/types';
import { focusAreaIdOf } from '@/ext/domain/initiatives';
import { NEXT_NAME, moveToNext, readObjective } from '@/ext/domain/objectives';
import { offsetOfDay, parentCadence, type Cadence } from '@/ext/domain/periods';
import { useTx, type ExtKey } from '@/ext/i18n';
import { dueDate } from '@/domain/dates';

/** One objective: tick it off, see what it supports, or move it on. */
export function ObjectiveRow({
  task, data, cadence, offset, now, parent, children, onOpenPeriod,
}: {
  task: Item;
  data: ExtData;
  cadence: Cadence;
  offset: number;
  now: Date;
  /** The objective a level up that this one supports, when it has one. */
  parent: Item | undefined;
  /** The objectives a level down that support this one. */
  children: Item[];
  onOpenPeriod: (cadence: Cadence, offset: number) => void;
}) {
  const { tx } = useTx();
  const update = useExt((state) => state.update);
  const toggleTask = useStore((s) => s.toggleTask);
  const updateTask = useStore((s) => s.updateTask);
  const toast = useStore((s) => s.toast);

  const read = readObjective(task, data.settings);
  const areaId = focusAreaIdOf(read.focus, data.focusAreas, data.settings.labels.focusPrefix);
  const area = data.focusAreas.find((entry) => entry.id === areaId);
  const up = parentCadence(cadence);
  const down = cadence === 'd' ? null : (['d', 'w', 'm'] as const)[['w', 'm', 'q'].indexOf(cadence)];

  const doneChildren = children.filter((child) => child.checked).length;

  const move = async () => {
    const parentDue = parent ? dueDate(parent) : null;
    const result = moveToNext(cadence, offset, now, parentDue);
    await updateTask(task.id, { due: { date: result.due } });
    /* A week moved into October cannot still support a September month, so
       the link goes with it rather than quietly pointing at the wrong thing. */
    if (result.dropParent) update((current) => linkObjective(current, task.id, null));
    toast(result.dropParent && parent
      ? tx('objectives.movedDropped', {
        next: tx(`objectives.cadence.${cadence}` as ExtKey).toLowerCase(),
        parent: parent.content,
      })
      : tx('objectives.moved', { next: NEXT_NAME[cadence] }));
  };

  return (
    <div className={`ext-objrow${task.checked ? ' done' : ''}`}>
      <button
        className="ext-objcheck"
        role="checkbox"
        aria-checked={task.checked}
        aria-label={task.content}
        onClick={() => void toggleTask(task.id)}
      >
        {task.checked && <Icon name="check" size="sm" />}
      </button>

      <span className="ext-objtitle">{task.content}</span>

      {area && (
        <span className="chip ext-focuschip" style={markerStyle(area.color)}>{area.short}</span>
      )}

      {parent && up && (
        <button
          className="chip ext-parentchip"
          onClick={() => {
            const day = dueDate(parent);
            if (day) onOpenPeriod(up, offsetOfDay(up, day, now));
          }}
        >
          ↑ {tx('objectives.supports', {
            cadence: tx(`objectives.cadence.${up}` as ExtKey),
            title: parent.content,
          })}
        </button>
      )}

      {down && children.length > 0 && (
        <button
          className="ext-objchildren"
          onClick={() => {
            const first = children.find((child) => !child.checked) ?? children[0];
            const day = dueDate(first);
            if (day) onOpenPeriod(down, offsetOfDay(down, day, now));
          }}
        >
          <span className="ext-progress">
            <span style={{ width: `${Math.round((doneChildren / children.length) * 100)}%` }} />
          </span>
          {tx('objectives.children', {
            done: doneChildren,
            total: children.length,
            cadence: tx(`objectives.cadence.${down}` as ExtKey).toLowerCase(),
          })}
        </button>
      )}

      {!task.checked && (
        <button className="btn sm quiet ext-objmove" onClick={() => void move()}>
          {tx('objectives.moveOne', { next: NEXT_NAME[cadence] })}
        </button>
      )}
    </div>
  );
}
