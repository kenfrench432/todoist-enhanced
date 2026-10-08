import { useMemo, useState } from 'react';
import { Icon } from '@/components/Icon';
import { Select } from '@/components/Select';
import { toApiDate } from '@/domain/dates';
import type { Item } from '@/domain/types';
import { useData } from '@/hooks/useData';
import { useToday } from '@/hooks/useToday';
import {
  addFocusArea, addGoal, addKpi, logKpiValue, removeFocusArea, removeGoal, removeKpi,
  updateFocusArea, updateGoal, updateKpi,
} from '@/ext/data/actions';
import { useExt } from '@/ext/data/store';
import { nextPaletteColor } from '@/ext/data/defaults';
import type { ExtData, Kpi } from '@/ext/data/types';
import { focusLabelChoices } from '@/ext/domain/labels';
import { initiativesIn } from '@/ext/domain/initiatives';
import { goalGroups, goalLinkCounts } from '@/ext/domain/manage';
import { kpiValue } from '@/ext/domain/pace';
import { numeric } from '@/ext/hooks/useDraftField';
import { useTx } from '@/ext/i18n';
import { Dot, DraftInput, LabelField, TwoStepRemove } from './parts';

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
      <FocusAreas data={data} />

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

/**
 * The focus areas, and the Todoist label each one means.
 *
 * The label is the consequential field: momentum counts completions carrying
 * it, and new initiatives and objectives are tagged with it. Changing it
 * re-points — nothing already tagged is relabelled — which the hint says,
 * because the alternative is wondering why momentum went quiet.
 */
function FocusAreas({ data }: { data: ExtData }) {
  const { tx } = useTx();
  const { snapshot } = useData();
  const update = useExt((state) => state.update);
  const [draft, setDraft] = useState('');

  const add = () => {
    const name = draft.trim();
    if (!name) return;
    update((current) => addFocusArea(current, name));
    setDraft('');
  };

  return (
    <section className="card ext-focusareas">
      <h2 className="ext-cardtitle">
        {tx('manage.focus.title')}
        <span className="ext-count">{data.focusAreas.length}</span>
      </h2>

      {data.focusAreas.length === 0 && <p className="ext-hint">{tx('manage.focus.none')}</p>}

      {data.focusAreas.map((area) => (
        <div className="ext-focusrow" key={area.id}>
          <Dot
            color={area.color}
            label={tx('manage.focus.colour')}
            onClick={() => update((c) => updateFocusArea(c, area.id, {
              color: nextPaletteColor(area.color),
            }))}
          />
          <DraftInput
            value={area.name}
            ariaLabel={tx('manage.focus.name')}
            onCommit={(name) => update((c) => updateFocusArea(c, area.id, { name }))}
          />
          <DraftInput
            className="ext-shortfield"
            value={area.short}
            ariaLabel={tx('manage.focus.short')}
            onCommit={(short) => update((c) => updateFocusArea(c, area.id, { short }))}
          />
          <LabelField
            label={`${tx('manage.focus.label')} — ${area.name}`}
            value={area.label}
            choices={focusLabelChoices(snapshot, data.settings, data.focusAreas, area.id)}
            onChange={(label) => update((c) => updateFocusArea(c, area.id, { label }))}
          />
          <DraftInput
            className="ext-whyfield"
            value={area.why}
            ariaLabel={`${tx('manage.focus.why')} — ${area.name}`}
            parse={(text) => text.trim()}
            onCommit={(why) => update((c) => updateFocusArea(c, area.id, { why }))}
          />
          <TwoStepRemove onRemove={() => update((c) => removeFocusArea(c, area.id))} />
        </div>
      ))}

      <div className="ext-addrow ext-focusadd">
        <input
          className="textfield"
          placeholder={tx('manage.focus.addPlaceholder')}
          aria-label={tx('manage.focus.add')}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter') add(); }}
        />
        <button className="btn sm" disabled={!draft.trim()} onClick={add}>
          {tx('manage.add')}
        </button>
      </div>

      <p className="ext-hint">{tx('manage.focus.hint')}</p>
    </section>
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
