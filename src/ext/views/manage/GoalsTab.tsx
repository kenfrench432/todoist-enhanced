import { useMemo, useState } from 'react';
import { Icon } from '@/components/Icon';
import { Select } from '@/components/Select';
import { toApiDate } from '@/domain/dates';
import type { Item } from '@/domain/types';
import { useToday } from '@/hooks/useToday';
import {
  addGoal, addKpi, logKpiValue, removeGoal, removeKpi, updateGoal, updateKpi,
} from '@/ext/data/actions';
import { useExt } from '@/ext/data/store';
import type { ExtData, Kpi } from '@/ext/data/types';
import { initiativesIn } from '@/ext/domain/initiatives';
import { goalGroups, goalLinkCounts } from '@/ext/domain/manage';
import { kpiValue } from '@/ext/domain/pace';
import { numeric } from '@/ext/hooks/useDraftField';
import { useTx } from '@/ext/i18n';
import { DraftInput, TwoStepRemove } from './parts';

export function GoalsTab({ data, items }: { data: ExtData; items: Item[] }) {
  const { tx } = useTx();
  const today = useToday();
  const update = useExt((state) => state.update);
  const [newGoal, setNewGoal] = useState('');
  const [newFocus, setNewFocus] = useState(data.focusAreas[0]?.id ?? '');

  const groups = useMemo(
    () => goalGroups(data.goals, data.focusAreas),
    [data.goals, data.focusAreas],
  );
  const linkCounts = useMemo(() => {
    const live = new Set(initiativesIn(items, data.settings).map((task) => task.id));
    return goalLinkCounts(data.initiativeGoals, live);
  }, [items, data.initiativeGoals, data.settings]);

  const focusOptions = [
    ...data.focusAreas.map((area) => ({ value: area.id, label: area.name, marker: area.color })),
    { value: '', label: tx('manage.goals.noFocus') },
  ];

  const add = () => {
    const title = newGoal.trim();
    if (!title) return;
    update((current) => addGoal(current, newFocus, title));
    setNewGoal('');
  };

  return (
    <div className="ext-tab">
      {data.goals.length === 0 && <p className="empty">{tx('manage.goals.emptyAll')}</p>}

      {groups.map((group) => (
        <section className="ext-group" key={group.focus?.id ?? 'none'}>
          <h2 className="ext-grouptitle">
            {group.focus?.name ?? tx('manage.goals.noFocus')}
            <span className="ext-count">{group.goals.length}</span>
          </h2>

          {group.goals.length === 0
            ? <p className="ext-hint">{tx('manage.goals.empty')}</p>
            : group.goals.map((goal) => (
              <article className="card ext-goal" key={goal.id}>
                <div className="ext-goalhead">
                  <DraftInput
                    className="ext-title"
                    value={goal.title}
                    ariaLabel={tx('manage.goals.titlePlaceholder')}
                    onCommit={(title) => update((c) => updateGoal(c, goal.id, { title }))}
                  />
                  <Select
                    ariaLabel={tx('manage.goals.focus')}
                    value={goal.focus}
                    options={focusOptions}
                    onChange={(focus) => update((c) => updateGoal(c, goal.id, { focus }))}
                  />
                </div>

                <KpiTable
                  kpis={data.kpis.filter((kpi) => kpi.goal === goal.id)}
                  today={today}
                />

                <div className="ext-goalfoot">
                  <button
                    className="btn sm"
                    onClick={() => update((c) => addKpi(c, goal.id, {
                      name: tx('manage.goals.newKpi'), unit: '', start: 0, target: 100,
                    }))}
                  >
                    <Icon name="plus" size="sm" />
                    {tx('manage.goals.addKpi')}
                  </button>
                  <span className="ext-hint">
                    {tx('manage.goals.linked', { count: linkCounts[goal.id] ?? 0 })}
                  </span>
                  <TwoStepRemove onRemove={() => update((c) => removeGoal(c, goal.id))} />
                </div>
              </article>
            ))}
        </section>
      ))}

      <section className="card ext-newgoal">
        <h2 className="ext-cardtitle">{tx('manage.goals.new')}</h2>
        <div className="ext-addrow">
          <input
            className="textfield"
            placeholder={tx('manage.goals.titlePlaceholder')}
            aria-label={tx('manage.goals.new')}
            value={newGoal}
            onChange={(event) => setNewGoal(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') add(); }}
          />
          <button className="btn primary" disabled={!newGoal.trim()} onClick={add}>
            {tx('manage.add')}
          </button>
        </div>
        <div className="chiprow ext-focuschips">
          {data.focusAreas.map((area) => (
            <button
              key={area.id}
              className="chip"
              aria-pressed={newFocus === area.id}
              onClick={() => setNewFocus(area.id)}
            >
              {area.short}
            </button>
          ))}
        </div>
        <p className="ext-hint">{tx('manage.goals.removeHint')}</p>
      </section>
    </div>
  );
}

/** Name | Now | Start | Target | Unit | ×, with Now writing to the history. */
function KpiTable({ kpis, today }: { kpis: Kpi[]; today: Date }) {
  const { tx } = useTx();
  const update = useExt((state) => state.update);

  if (kpis.length === 0) return <p className="ext-hint">{tx('manage.goals.noKpis')}</p>;

  return (
    <div className="ext-tablewrap">
      <table className="ext-table ext-kpitable">
        <thead>
          <tr>
            <th>{tx('manage.goals.kpiName')}</th>
            <th className="ext-num">{tx('manage.goals.kpiNow')}</th>
            <th className="ext-num">{tx('manage.goals.kpiStart')}</th>
            <th className="ext-num">{tx('manage.goals.kpiTarget')}</th>
            <th>{tx('manage.goals.kpiUnit')}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {kpis.map((kpi) => (
            <tr key={kpi.id}>
              <td data-label={tx('manage.goals.kpiName')}>
                <DraftInput
                  value={kpi.name}
                  ariaLabel={tx('manage.goals.kpiName')}
                  onCommit={(name) => update((c) => updateKpi(c, kpi.id, { name }))}
                />
              </td>
              {/* Editing Now files a reading under today, replacing one made
                  earlier today rather than stacking a second. */}
              <td className="ext-num" data-label={tx('manage.goals.kpiNow')}>
                <DraftInput
                  className="ext-numfield"
                  value={String(kpiValue(kpi))}
                  ariaLabel={`${kpi.name} ${tx('manage.goals.kpiNow')}`}
                  parse={(text) => (numeric(text) === null ? null : text)}
                  onCommit={(text) =>
                    update((c) => logKpiValue(c, kpi.id, Number(text), toApiDate(today)))}
                />
              </td>
              <td className="ext-num" data-label={tx('manage.goals.kpiStart')}>
                <DraftInput
                  className="ext-numfield"
                  value={String(kpi.start)}
                  ariaLabel={`${kpi.name} ${tx('manage.goals.kpiStart')}`}
                  parse={(text) => (numeric(text) === null ? null : text)}
                  onCommit={(text) => update((c) => updateKpi(c, kpi.id, { start: Number(text) }))}
                />
              </td>
              <td className="ext-num" data-label={tx('manage.goals.kpiTarget')}>
                <DraftInput
                  className="ext-numfield"
                  value={String(kpi.target)}
                  ariaLabel={`${kpi.name} ${tx('manage.goals.kpiTarget')}`}
                  parse={(text) => (numeric(text) === null ? null : text)}
                  onCommit={(text) => update((c) => updateKpi(c, kpi.id, { target: Number(text) }))}
                />
              </td>
              <td data-label={tx('manage.goals.kpiUnit')}>
                <DraftInput
                  className="ext-unitfield"
                  value={kpi.unit}
                  ariaLabel={`${kpi.name} ${tx('manage.goals.kpiUnit')}`}
                  /* A unit is allowed to be nothing: "12 open tickets" has none. */
                  parse={(text) => text.trim()}
                  onCommit={(unit) => update((c) => updateKpi(c, kpi.id, { unit }))}
                />
              </td>
              <td className="ext-rowactions">
                <button
                  className="iconbtn"
                  aria-label={`${tx('manage.remove')} ${kpi.name}`}
                  onClick={() => update((c) => removeKpi(c, kpi.id))}
                >
                  <Icon name="close" size="sm" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
