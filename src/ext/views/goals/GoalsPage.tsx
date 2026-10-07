import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import type { LoadSummary } from '@/domain/load';
import { useCompleted } from '@/hooks/useCompleted';
import { useData } from '@/hooks/useData';
import { navigate, type Route } from '@/hooks/useRoute';
import { useToday } from '@/hooks/useToday';
import { useStore } from '@/store/store';
import { demoCompleted } from '@/ext/demo';
import { useExt } from '@/ext/data/store';
import {
  focusAreaIdOf, initiativesIn, isLive, readInitiative,
} from '@/ext/domain/initiatives';
import { focusCompletions, momentumSince } from '@/ext/domain/momentum';
import { daysLeftInYear, elapsedShare, goalYearStart, paceSummary } from '@/ext/domain/pace';
import { useTx } from '@/ext/i18n';
import { GoalCard } from './GoalCard';
import { MomentumCard, type MomentumNext } from './MomentumCard';

const EMPTY_LOAD: LoadSummary = {
  taskCount: 0, estimatedMinutes: 0, unestimatedCount: 0, percentage: null, level: null,
};

/**
 * Two questions, deliberately side by side: are the numbers moving, and is
 * anyone doing anything about it.
 *
 * A goal can read perfectly well on its KPI and have had nothing done about it
 * for a month. The momentum cards are what catch that.
 */
export function GoalsPage({ route }: { route: Route }) {
  const { tx } = useTx();
  const today = useToday();
  const { items, childrenOf } = useData();
  const data = useExt((state) => state.data);

  /* The address can name a focus area, which is where Initiatives' "Supports
     goal" link lands. */
  const fromRoute = data.focusAreas.some((area) => area.id === route.id) ? route.id! : null;
  const [picked, setPicked] = useState<string | null>(null);
  const focus = picked ?? fromRoute;

  const yearStart = data.settings.yearStartMonth;

  /* Eight ISO weeks, fetched once per visit. */
  const range = useMemo(
    () => ({ since: momentumSince(today), until: today }),
    [today],
  );
  const { data: fetched } = useCompleted(range, true);
  /* The demo's own sample completions. upstream's buildDemoCompleted is called
     inside useCompleted and carries none of the fork's labels, so momentum
     would read Stalling everywhere; substituting here keeps that fix inside
     src/ext rather than spending an upstream line on a demo cosmetic. */
  const demo = useStore((s) => s.demo);
  const completed = useMemo(
    () => (demo ? demoCompleted(today) : fetched),
    [demo, today, fetched],
  );

  const initiatives = useMemo(
    () => initiativesIn(items, data.settings),
    [items, data.settings],
  );

  /** What each focus area has open, for the card's last line. */
  const nextByArea = useMemo(() => {
    const prefix = data.settings.labels.focusPrefix;
    const out: Record<string, MomentumNext> = {};
    for (const area of data.focusAreas) {
      const mine = initiatives.filter((task) =>
        focusAreaIdOf(readInitiative(task, data.settings).focus, data.focusAreas, prefix)
          === area.id);
      let noNextAction = 0;
      let next: string | null = null;
      for (const task of mine) {
        const read = readInitiative(task, data.settings);
        const open = childrenOf(task.id).filter((child) => !child.checked);
        if (isLive(read.status) && open.length === 0) noNextAction += 1;
        if (next === null && read.status === 'active' && open.length > 0) next = open[0].content;
      }
      out[area.id] = { noNextAction, next };
    }
    return out;
  }, [initiatives, data.focusAreas, data.settings, childrenOf]);

  const shownGoals = focus === null
    ? data.goals
    : data.goals.filter((goal) => goal.focus === focus);
  const shownKpis = data.kpis.filter((kpi) =>
    shownGoals.some((goal) => goal.id === kpi.goal));
  const summary = paceSummary(shownKpis, today, yearStart);

  const subtitle = tx('goals.subtitle', {
    year: goalYearStart(today, yearStart).getFullYear(),
    elapsed: Math.round(elapsedShare(today, yearStart) * 100),
    left: daysLeftInYear(today, yearStart),
  });

  const pick = (areaId: string) => {
    const next = focus === areaId ? null : areaId;
    setPicked(next);
    /* The address follows the choice, so the page can be linked to and Back
       walks between areas. */
    navigate('goals', next ?? undefined);
  };

  return (
    <div className="page ext-page ext-goals">
      <PageHeader title={tx('page.goals.title')} subtitle={subtitle} load={EMPTY_LOAD} />

      <div className="ext-momentumgrid">
        {data.focusAreas.map((area) => (
          <MomentumCard
            key={area.id}
            area={area}
            completions={focusCompletions(completed, area.label)}
            floor={data.settings.momentumFloor}
            now={today}
            selected={focus === area.id}
            onSelect={() => pick(area.id)}
            next={nextByArea[area.id] ?? { noNextAction: 0, next: null }}
          />
        ))}
      </div>

      <div className="ext-goalstop">
        <span className="ext-hint">{tx('goals.paceSummary', { ...summary })}</span>
        {focus !== null && (
          <button className="btn sm quiet" onClick={() => { setPicked(null); navigate('goals'); }}>
            {tx('goals.clearFocus')}
          </button>
        )}
      </div>

      {data.goals.length === 0 && <p className="empty">{tx('goals.empty')}</p>}
      {data.goals.length > 0 && shownGoals.length === 0 && (
        <p className="empty">{tx('goals.emptyFocus')}</p>
      )}

      {shownGoals.map((goal) => (
        <GoalCard
          key={goal.id}
          goal={goal}
          kpis={data.kpis.filter((kpi) => kpi.goal === goal.id)}
          area={data.focusAreas.find((entry) => entry.id === goal.focus)}
          initiatives={initiatives.filter((task) => data.initiativeGoals[task.id] === goal.id)}
          data={data}
          today={today}
        />
      ))}
    </div>
  );
}
