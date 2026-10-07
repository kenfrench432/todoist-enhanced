import { useMemo, useState } from 'react';
import { Icon } from '@/components/Icon';
import { PageHeader } from '@/components/PageHeader';
import { dueDate } from '@/domain/dates';
import type { LoadSummary } from '@/domain/load';
import { useCompleted } from '@/hooks/useCompleted';
import { useStore } from '@/store/store';
import { useToday } from '@/hooks/useToday';
import { linkObjective } from '@/ext/data/actions';
import { useExt } from '@/ext/data/store';
import {
  NEXT_NAME, cadenceCounts, capFor, capacity, mergeCompleted, moveToNext, objectivesInPeriod,
} from '@/ext/domain/objectives';
import {
  CADENCES, periodKey, periodOf, parentCadence, type Cadence,
} from '@/ext/domain/periods';
import { useTx, type ExtKey } from '@/ext/i18n';
import { NewObjective } from './NewObjective';
import { ObjectiveRow } from './ObjectiveRow';
import { PlanReview } from './PlanReview';

const EMPTY_LOAD: LoadSummary = {
  taskCount: 0, estimatedMinutes: 0, unestimatedCount: 0, percentage: null, level: null,
};

/**
 * A few outcomes per day, week, month and quarter, each supporting the level
 * above it.
 *
 * Objectives are read from the snapshot rather than `openItems`, because a
 * completed one still belongs to its period: "2 of 3 done" needs the one that
 * is done.
 */
export function ObjectivesPage() {
  const { tx } = useTx();
  const now = useToday();
  const snapshot = useStore((s) => s.snapshot);
  const data = useExt((state) => state.data);
  const update = useExt((state) => state.update);
  const updateTask = useStore((s) => s.updateTask);
  const toast = useStore((s) => s.toast);

  const [cadence, setCadence] = useState<Cadence>('d');
  const [offset, setOffset] = useState(0);
  const [adding, setAdding] = useState(false);

  const period = useMemo(() => periodOf(cadence, offset, now), [cadence, offset, now]);
  const all = useMemo(() => Object.values(snapshot.items), [snapshot.items]);

  const objectives = useMemo(
    () => objectivesInPeriod(all, data.settings, cadence, period),
    [all, data.settings, cadence, period],
  );

  /* Only a period the snapshot may have forgotten needs the completed API. */
  const stale = offset < -1;
  const { data: completed } = useCompleted(
    useMemo(() => ({ since: period.start, until: period.end }), [period]),
    stale,
  );
  const recovered = useMemo(
    () => (stale ? mergeCompleted(objectives, completed, data.settings, cadence, period) : []),
    [stale, objectives, completed, data.settings, cadence, period],
  );

  const cap = capFor(cadence, data.settings);
  const room = capacity(objectives, cap);
  const open = objectives.filter((item) => !item.checked);

  /* The objectives a level up, for the parent chip and the new form. */
  const up = parentCadence(cadence);
  const above = useMemo(() => {
    if (!up) return [];
    /* Two periods either side, so a parent just outside this window still
       resolves — the form filters to the ones that can actually hold it. */
    return [-2, -1, 0, 1, 2].flatMap((step) =>
      objectivesInPeriod(all, data.settings, up, periodOf(up, step, now)));
  }, [up, all, data.settings, now]);

  const down = cadence === 'd' ? null : (['d', 'w', 'm'] as const)[CADENCES.indexOf(cadence) - 1];
  const below = useMemo(() => {
    if (!down) return [];
    return [-1, 0, 1, 2, 3, 4].flatMap((step) =>
      objectivesInPeriod(all, data.settings, down, periodOf(down, step, now)));
  }, [down, all, data.settings, now]);

  const tabCounts = useMemo(() => Object.fromEntries(CADENCES.map((value: Cadence) => [
    value,
    cadenceCounts(objectivesInPeriod(all, data.settings, value, periodOf(value, 0, now))),
  ])) as Record<Cadence, { done: number; total: number }>, [all, data.settings, now]);

  /** Everything still open, moved on together. */
  const moveAll = async () => {
    for (const task of open) {
      const parent = above.find((item) => item.id === data.objectiveParents[task.id]);
      const result = moveToNext(cadence, offset, now, parent ? dueDate(parent) : null);
      await updateTask(task.id, { due: { date: result.due } });
      if (result.dropParent) update((current) => linkObjective(current, task.id, null));
    }
    toast(tx('objectives.moved', { next: NEXT_NAME[cadence] }));
  };

  const openPeriod = (next: Cadence, nextOffset: number) => {
    setCadence(next);
    setOffset(nextOffset);
  };

  const note = periodKey(cadence, period.start);

  return (
    <div className="page ext-page ext-objectives">
      <PageHeader
        title={tx('page.objectives.title')}
        subtitle={tx('objectives.intro')}
        load={EMPTY_LOAD}
      />

      <div className="tabs" role="tablist">
        {CADENCES.map((value: Cadence) => (
          <button
            key={value}
            role="tab"
            aria-selected={cadence === value}
            onClick={() => { setCadence(value); setOffset(0); }}
          >
            {tx(`objectives.cadence.${value}` as ExtKey)}
            <span className="ext-tabcount">
              {tabCounts[value].done}/{tabCounts[value].total}
            </span>
          </button>
        ))}
      </div>

      <div className="toolbar ext-periodbar">
        <button
          className="iconbtn"
          aria-label={tx('objectives.previous')}
          onClick={() => setOffset(offset - 1)}
        >
          <Icon name="arrow-left" size="sm" />
        </button>
        <span className="ext-periodtext">
          <strong>{period.title}</strong>
          <span className="ext-hint">{period.subtitle}</span>
        </span>
        <button
          className="iconbtn"
          aria-label={tx('objectives.next')}
          onClick={() => setOffset(offset + 1)}
        >
          <Icon name="arrow-right" size="sm" />
        </button>
        {offset !== 0 && (
          <button className="btn sm quiet" onClick={() => setOffset(0)}>
            {tx('objectives.backToToday')}
          </button>
        )}
        <button className="btn sm ext-newobjbtn" onClick={() => setAdding(true)}>
          <Icon name="plus" size="sm" />
          {tx('objectives.new')}
        </button>
      </div>

      <div className="ext-capacity">
        <span className="ext-slots">
          {room.slots.map((slot, index) => (
            <span className={`ext-slot ${slot}`} key={index} />
          ))}
        </span>
        <span className="ext-hint">
          {tx('objectives.capacity', { open: room.open, done: room.done, cap })}
        </span>
        <span className={`ext-hint${room.over ? ' ext-belowfloor' : ''}`}>
          {room.over
            ? tx('objectives.over', { cap })
            : room.total === cap
              ? tx('objectives.full')
              : tx('objectives.free', { count: cap - room.total })}
        </span>
        {open.length > 0 && (
          <button className="btn sm quiet ext-moveall" onClick={() => void moveAll()}>
            {tx('objectives.moveAll', { count: open.length, next: NEXT_NAME[cadence] })}
          </button>
        )}
      </div>

      {adding && (
        <NewObjective
          data={data}
          cadence={cadence}
          offset={offset}
          now={now}
          above={above}
          onDone={() => setAdding(false)}
        />
      )}

      {objectives.length === 0 && recovered.length === 0 && (
        <p className="empty">{tx('objectives.empty')}</p>
      )}

      {objectives.map((task) => (
        <ObjectiveRow
          key={task.id}
          task={task}
          data={data}
          cadence={cadence}
          offset={offset}
          now={now}
          parent={above.find((item) => item.id === data.objectiveParents[task.id])}
          children={below.filter((item) => data.objectiveParents[item.id] === task.id)}
          onOpenPeriod={openPeriod}
        />
      ))}

      {recovered.map((row) => (
        <div className="ext-objrow done ext-recovered" key={row.id}>
          <span className="ext-objcheck" aria-hidden="true"><Icon name="check" size="sm" /></span>
          <span className="ext-objtitle">{row.content}</span>
          <span className="ext-hint">{tx('objectives.recovered')}</span>
        </div>
      ))}

      <PlanReview cadence={cadence} periodKey={note} />
    </div>
  );
}
