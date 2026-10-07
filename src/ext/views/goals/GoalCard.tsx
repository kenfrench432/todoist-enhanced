import { markerStyle } from '@/domain/colors';
import { toApiDate } from '@/domain/dates';
import type { Item } from '@/domain/types';
import { navigate } from '@/hooks/useRoute';
import { logKpiValue } from '@/ext/data/actions';
import { useExt } from '@/ext/data/store';
import type { ExtData, FocusArea, Goal, Kpi } from '@/ext/data/types';
import { STATUS_TONES, readInitiative } from '@/ext/domain/initiatives';
import { kpiDelta, kpiPace, kpiValue } from '@/ext/domain/pace';
import { numeric } from '@/ext/hooks/useDraftField';
import { useTx, type ExtKey } from '@/ext/i18n';
import { DraftInput } from '../manage/parts';

const PACE_TONE: Record<string, string> = {
  reached: 'green', onTrack: 'green', atRisk: 'orange', behind: 'red',
};
const STATUS_COLORS: Record<string, string> = {
  blue: 'blue', green: 'green', amber: 'orange', red: 'red', gray: 'charcoal',
};

/** One goal: its KPIs against the year, and the initiatives supporting it. */
export function GoalCard({
  goal, kpis, area, initiatives, data, today,
}: {
  goal: Goal;
  kpis: Kpi[];
  area: FocusArea | undefined;
  /** The Todoist tasks linked to this goal. */
  initiatives: Item[];
  data: ExtData;
  today: Date;
}) {
  const { tx } = useTx();
  const update = useExt((state) => state.update);
  const yearStart = data.settings.yearStartMonth;

  return (
    <article className="card ext-goalcard">
      <div className="ext-goalcardhead">
        <h3 className="ext-goaltitle">{goal.title}</h3>
        {area && (
          <span className="chip ext-focuschip" style={markerStyle(area.color)}>{area.short}</span>
        )}
      </div>

      {kpis.length === 0
        ? <p className="ext-hint">{tx('goals.noKpis')}</p>
        : kpis.map((kpi) => {
          const pace = kpiPace(kpi, today, yearStart);
          const delta = kpiDelta(kpi);
          /* Clamped for drawing only: a KPI past its target or gone backwards
             still has a bar that stays inside its track. */
          const filled = Math.max(0, Math.min(1, pace.progress));

          return (
            <div className="ext-kpirow" key={kpi.id}>
              <div className="ext-kpitop">
                <span className="ext-kpiname">{kpi.name}</span>
                <DraftInput
                  className="ext-numfield"
                  value={String(kpiValue(kpi))}
                  ariaLabel={`${kpi.name} ${tx('goals.now')}`}
                  parse={(text) => (numeric(text) === null ? null : text)}
                  onCommit={(text) =>
                    update((current) =>
                      logKpiValue(current, kpi.id, Number(text), toApiDate(today)))}
                />
                <span className="ext-hint">
                  {tx('goals.target', { target: kpi.target, unit: kpi.unit })}
                </span>
              </div>

              <div className="ext-pacebar">
                <span className="ext-pacefill" style={{ width: `${Math.round(filled * 100)}%` }} />
                {/* Where it should have got to by now, which is what makes the
                    bar a judgement rather than a number. */}
                <i
                  className="ext-pacemark"
                  style={{ left: `${Math.round(pace.elapsed * 100)}%` }}
                  title={tx('goals.expected')}
                />
              </div>

              <div className="ext-kpifoot">
                <span
                  className={`chip ext-pacechip ${pace.state}`}
                  style={markerStyle(PACE_TONE[pace.state] ?? 'charcoal')}
                >
                  {tx(`goals.pace.${pace.state}` as ExtKey)}
                </span>
                <span className="ext-hint">
                  {delta === null
                    ? tx('goals.noDelta')
                    : delta === 0
                      ? tx('goals.noChange')
                      : tx('goals.delta', {
                        delta: delta > 0 ? `+${delta}` : String(delta), unit: kpi.unit,
                      })}
                </span>
              </div>
            </div>
          );
        })}

      <div className="ext-linked">
        <span className="ext-hint">{tx('goals.linked')}</span>
        {initiatives.length === 0
          ? <span className="ext-hint">{tx('goals.linkedNone')}</span>
          : (
            <span className="chiprow">
              {initiatives.map((task) => {
                const read = readInitiative(task, data.settings);
                return (
                  <button
                    key={task.id}
                    className="chip ext-initchip"
                    onClick={() => navigate('initiatives')}
                  >
                    <span
                      className="ext-statusdot"
                      style={markerStyle(STATUS_COLORS[STATUS_TONES[read.status]] ?? 'charcoal')}
                    />
                    {task.content}
                  </button>
                );
              })}
            </span>
          )}
      </div>
    </article>
  );
}
