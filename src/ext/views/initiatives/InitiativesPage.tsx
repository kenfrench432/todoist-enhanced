import { useMemo, useState } from 'react';
import { subDays } from 'date-fns';
import { Icon } from '@/components/Icon';
import { PageHeader } from '@/components/PageHeader';
import { markerStyle } from '@/domain/colors';
import type { LoadSummary } from '@/domain/load';
import { useCompleted } from '@/hooks/useCompleted';
import { useData } from '@/hooks/useData';
import { useToday } from '@/hooks/useToday';
import { useStore } from '@/store/store';
import { demoCompleted } from '@/ext/demo';
import { useExt } from '@/ext/data/store';
import {
  completedInitiatives, groupInitiatives, initiativeSummary, initiativesIn,
  readInitiative, type GroupBy,
} from '@/ext/domain/initiatives';
import { useTx, type ExtKey } from '@/ext/i18n';
import { InitiativeCard } from './InitiativeCard';

const EMPTY_LOAD: LoadSummary = {
  taskCount: 0, estimatedMinutes: 0, unestimatedCount: 0, percentage: null, level: null,
};

/** Initiatives are long-lived, so "completed" reaches back a quarter. */
const COMPLETED_DAYS = 90;

/**
 * The internal work: what is live, what is stuck, and what is quietly going
 * nowhere.
 *
 * The rules are in src/ext/domain/initiatives.ts and tested there; this is the
 * page that arranges them.
 */
export function InitiativesPage({ onOpen }: { onOpen: (id: string) => void }) {
  const { tx } = useTx();
  const now = useToday();
  const { items, childrenOf } = useData();
  const data = useExt((state) => state.data);

  const [by, setBy] = useState<GroupBy>('focus');
  const [focus, setFocus] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);

  /* Fetched once per visit, and only when the switch is on: the completed API
     is a round trip, and the switch is off by default. */
  const range = useMemo(
    () => ({ since: subDays(now, COMPLETED_DAYS), until: now }),
    [now],
  );
  const { data: fetched, loading } = useCompleted(range, showCompleted);
  // The demo's own sample completions; see GoalsPage for why.
  const demo = useStore((s) => s.demo);
  const completed = useMemo(
    () => (demo ? demoCompleted(now) : fetched),
    [demo, now, fetched],
  );

  const initiatives = useMemo(
    () => initiativesIn(items, data.settings),
    [items, data.settings],
  );

  const summary = useMemo(() => initiativeSummary(initiatives.map((task) => ({
    initiative: readInitiative(task, data.settings),
    children: childrenOf(task.id),
  }))), [initiatives, data.settings, childrenOf]);

  const groups = useMemo(() => {
    const grouped = groupInitiatives(initiatives, by, data.focusAreas, data.settings);
    /* The chips narrow by focus area, which only means something when the
       groups are focus areas; grouped by status they filter across all of them. */
    if (focus === null) return grouped;
    if (by === 'focus') return grouped.filter((group) => group.key === focus);
    const wanted = new Set(
      groupInitiatives(initiatives, 'focus', data.focusAreas, data.settings)
        .find((group) => group.key === focus)?.tasks.map((task) => task.id) ?? [],
    );
    return grouped
      .map((group) => ({ ...group, tasks: group.tasks.filter((task) => wanted.has(task.id)) }))
      .filter((group) => group.tasks.length > 0);
  }, [initiatives, by, focus, data.focusAreas, data.settings]);

  const doneRows = useMemo(
    () => completedInitiatives(completed, data.settings),
    [completed, data.settings],
  );

  const focusCounts = useMemo(() => Object.fromEntries(
    groupInitiatives(initiatives, 'focus', data.focusAreas, data.settings)
      .map((group) => [group.key, group.tasks.length]),
  ), [initiatives, data.focusAreas, data.settings]);

  const subtitle = [
    tx('initiatives.summary.active', { count: summary.active }),
    ...(summary.blocked > 0 ? [tx('initiatives.summary.blocked', { count: summary.blocked })] : []),
    ...(summary.noNextAction > 0
      ? [tx('initiatives.summary.noNext', { count: summary.noNextAction })] : []),
  ].join(' · ');

  return (
    <div className="page ext-page ext-initiatives">
      <PageHeader title={tx('page.initiatives.title')} subtitle={subtitle} load={EMPTY_LOAD} />

      <div className="toolbar ext-toolbar">
        <div className="segmented small" aria-label={tx('initiatives.groupBy')}>
          {(['focus', 'status'] as GroupBy[]).map((value) => (
            <button key={value} aria-pressed={by === value} onClick={() => setBy(value)}>
              {tx(`initiatives.groupBy.${value}` as ExtKey)}
            </button>
          ))}
        </div>

        <span className="ext-switch">
          <button
            type="button"
            className="switch"
            role="switch"
            aria-checked={showCompleted}
            aria-label={tx('initiatives.showCompleted')}
            onClick={() => setShowCompleted(!showCompleted)}
          />
          <button
            type="button"
            className="ext-switchlabel"
            tabIndex={-1}
            onClick={() => setShowCompleted(!showCompleted)}
          >
            {tx('initiatives.showCompleted')}
          </button>
        </span>
      </div>

      <div className="chiprow ext-focusfilter">
        <button className="chip" aria-pressed={focus === null} onClick={() => setFocus(null)}>
          {tx('initiatives.allFocus')}
          <span className="ext-chipcount">{initiatives.length}</span>
        </button>
        {data.focusAreas.map((area) => (
          <button
            key={area.id}
            className="chip"
            aria-pressed={focus === area.id}
            style={markerStyle(area.color)}
            onClick={() => setFocus(focus === area.id ? null : area.id)}
          >
            {area.short}
            <span className="ext-chipcount">{focusCounts[area.id] ?? 0}</span>
          </button>
        ))}
      </div>

      {initiatives.length === 0 && <p className="empty">{tx('initiatives.empty')}</p>}

      {initiatives.length > 0 && groups.length === 0 && (
        <p className="empty">{tx('initiatives.noFilterMatches')}</p>
      )}

      {groups.map((group) => (
        <section className="ext-group" key={group.key}>
          <h2 className="ext-grouptitle">
            {group.color && <span className="ext-dot" style={markerStyle(group.color)}><span /></span>}
            {group.title}
            <span className="ext-count">{group.tasks.length}</span>
          </h2>
          {group.tasks.length === 0
            ? <p className="ext-hint">{tx('initiatives.emptyGroup')}</p>
            : group.tasks.map((task) => (
              <InitiativeCard
                key={task.id}
                task={task}
                subtasks={childrenOf(task.id)}
                childrenOf={childrenOf}
                onOpen={onOpen}
                data={data}
                area={data.focusAreas.find((entry) => entry.id === group.key)}
                now={now}
              />
            ))}
        </section>
      ))}

      {showCompleted && (
        <section className="ext-group">
          <h2 className="ext-grouptitle">
            {tx('initiatives.completed')}
            <span className="ext-count">{doneRows.length}</span>
          </h2>
          {loading && <p className="ext-hint">{tx('common.loading')}</p>}
          {!loading && doneRows.length === 0 && (
            <p className="ext-hint">{tx('initiatives.completedNone')}</p>
          )}
          {doneRows.map((row) => (
            <div className="ext-donerow" key={row.id}>
              <Icon name="check" size="sm" />
              <span className="ext-doneitem">{row.content}</span>
              <span className="ext-hint">
                {tx('initiatives.completedAt', { date: row.completed_at.slice(0, 10) })}
              </span>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
