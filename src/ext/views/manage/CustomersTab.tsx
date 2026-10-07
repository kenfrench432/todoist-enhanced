import { useMemo, useState } from 'react';
import { Icon } from '@/components/Icon';
import { Select } from '@/components/Select';
import type { Item, Snapshot } from '@/domain/types';
import { useStore } from '@/store/store';
import {
  addCsm, addCustomer, addStage, cycleTone, moveStage, removeCsm, removeCustomer,
  removeStage, renameCsm, renameCustomer, renameStage, setCustomer, setSettings,
} from '@/ext/data/actions';
import { useExt } from '@/ext/data/store';
import type { ExtData, Tier } from '@/ext/data/types';
import { slug } from '@/ext/domain/labels';
import { customerCounts, duplicateName, unlinkedLabels } from '@/ext/domain/manage';
import { useTx } from '@/ext/i18n';
import { Disclosed, Dot, DraftInput, NameList, ProjectField, TwoStepRemove } from './parts';

const TIERS: Tier[] = ['P1', 'P2', 'P3'];

export function CustomersTab(
  { data, snapshot, items }: { data: ExtData; snapshot: Snapshot; items: Item[] },
) {
  const { tx } = useTx();
  const update = useExt((state) => state.update);
  const createLabel = useStore((s) => s.createLabel);
  const toast = useStore((s) => s.toast);
  const [draft, setDraft] = useState('');

  const counts = useMemo(() => customerCounts(items, data.customers), [items, data.customers]);
  const unlinked = useMemo(
    () => unlinkedLabels(snapshot, data.customers, data.settings),
    [snapshot, data.customers, data.settings],
  );

  const label = slug(draft);
  const taken = data.customers.some((customer) => customer.label === label);
  const canAdd = label.length > 0 && !taken;

  /* The Todoist label has to exist before a task can carry it, and an account
     may well already have one from before the fork — createLabel leaves an
     existing label alone, so this is safe either way. */
  const add = async (name: string) => {
    const wanted = slug(name);
    if (!wanted) return;
    await createLabel(wanted);
    update((current) => addCustomer(current, name, wanted));
    toast(tx('manage.customers.added'));
  };

  const csmOptions = [
    { value: '', label: tx('manage.unassigned') },
    ...data.csms.map((csm) => ({ value: csm.id, label: csm.name })),
  ];
  const stageOptions = data.stages.map((stage) => ({ value: stage.id, label: stage.name }));

  return (
    <div className="ext-tab">
      <section className="ext-addcustomer">
        <label className="fieldlabel" htmlFor="ext-add-customer">
          {tx('manage.customers.add')}
        </label>
        <div className="ext-addrow">
          <input
            id="ext-add-customer"
            className={`textfield${taken ? ' ext-invalid' : ''}`}
            placeholder={tx('manage.customers.addPlaceholder')}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' || !canAdd) return;
              void add(draft);
              setDraft('');
            }}
          />
          <button
            className="btn primary"
            disabled={!canAdd}
            onClick={() => { void add(draft); setDraft(''); }}
          >
            {tx('manage.add')}
          </button>
        </div>
        {/* The label is what every task will carry, so it is shown before the
            customer exists rather than discovered afterwards. */}
        {draft.trim() && (
          <p className="ext-hint">
            {tx('manage.customers.labelPreview')} <code className="ext-labelchip">@{label}</code>
            {taken && ` · ${tx('manage.duplicate')}`}
          </p>
        )}
      </section>

      <div className="ext-twocards">
        <Disclosed
          title={tx('manage.customers.csms')}
          summary={data.csms.length > 0
            ? data.csms.map((csm) => csm.name).join(', ')
            : tx('manage.customers.noCsms')}
        >
          <NameList
            rows={data.csms}
            addPlaceholder={tx('manage.customers.csmPlaceholder')}
            duplicate={(name, selfId) => duplicateName(data.csms, name, selfId)}
            countOf={(row) => data.customers.filter((c) => c.csm === row.id).length}
            onRename={(id, name) => update((current) => renameCsm(current, id, name))}
            onAdd={(name) => update((current) => addCsm(current, name))}
            onRemove={(id) => update((current) => removeCsm(current, id))}
          />
        </Disclosed>

        <Disclosed
          title={tx('manage.customers.stages')}
          summary={data.stages.map((stage) => stage.name).join(' → ')}
        >
          <NameList
            rows={data.stages}
            addPlaceholder={tx('manage.customers.stagePlaceholder')}
            duplicate={(name, selfId) => duplicateName(data.stages, name, selfId)}
            countOf={(row) => data.customers.filter((c) => c.stage === row.id).length}
            /* The last stage stays: every customer is at one. */
            canRemove={() => data.stages.length > 1}
            onRename={(id, name) => update((current) => renameStage(current, id, name))}
            onAdd={(name) => update((current) => addStage(current, name))}
            onRemove={(id) => update((current) => removeStage(current, id))}
            rowExtra={(row, index) => (
              <span className="ext-stagetools">
                <Dot
                  color={toneColor(data.stages[index].tone)}
                  label={tx('manage.customers.tone')}
                  onClick={() => update((current) => cycleTone(current, row.id))}
                />
                <button
                  className="iconbtn"
                  aria-label={tx('manage.customers.moveUp')}
                  disabled={index === 0}
                  onClick={() => update((current) => moveStage(current, row.id, -1))}
                >
                  <Icon name="caret-up" size="sm" />
                </button>
                <button
                  className="iconbtn"
                  aria-label={tx('manage.customers.moveDown')}
                  disabled={index === data.stages.length - 1}
                  onClick={() => update((current) => moveStage(current, row.id, 1))}
                >
                  <Icon name="caret" size="sm" />
                </button>
              </span>
            )}
          />
          {data.stages.length === 1 && (
            <p className="ext-hint">{tx('manage.customers.lastStage')}</p>
          )}
        </Disclosed>
      </div>

      <ProjectField
        label={tx('manage.customers.where')}
        value={data.settings.customersProjectId}
        onChange={(projectId) =>
          update((current) => setSettings(current, { customersProjectId: projectId }))}
      />

      {data.customers.length === 0
        ? <p className="empty">{tx('manage.customers.empty')}</p>
        : (
          <div className="ext-tablewrap">
            <table className="ext-table">
              <thead>
                <tr>
                  <th>{tx('manage.customers.colName')}</th>
                  <th>{tx('manage.customers.colLabel')}</th>
                  <th>{tx('manage.customers.colCsm')}</th>
                  <th>{tx('manage.customers.colStage')}</th>
                  <th>{tx('manage.customers.colTier')}</th>
                  <th className="ext-num">{tx('manage.customers.colTasks')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.customers.map((customer) => (
                  <tr key={customer.id}>
                    <td data-label={tx('manage.customers.colName')}>
                      <span className="ext-namecell">
                        <Dot color={customer.color} />
                        <DraftInput
                          value={customer.name}
                          ariaLabel={tx('manage.customers.colName')}
                          parse={(text) => {
                            const name = text.trim();
                            return name && !duplicateName(data.customers, name, customer.id)
                              ? name : null;
                          }}
                          onCommit={(name) =>
                            update((current) => renameCustomer(current, customer.id, name))}
                        />
                      </span>
                    </td>
                    <td data-label={tx('manage.customers.colLabel')}>
                      <code className="ext-labelchip">@{customer.label}</code>
                    </td>
                    <td data-label={tx('manage.customers.colCsm')}>
                      <Select
                        ariaLabel={tx('manage.customers.colCsm')}
                        value={customer.csm ?? ''}
                        options={csmOptions}
                        onChange={(value) =>
                          update((c) => setCustomer(c, customer.id, { csm: value || null }))}
                      />
                    </td>
                    <td data-label={tx('manage.customers.colStage')}>
                      <Select
                        ariaLabel={tx('manage.customers.colStage')}
                        value={customer.stage}
                        options={stageOptions}
                        onChange={(value) =>
                          update((c) => setCustomer(c, customer.id, { stage: value }))}
                      />
                    </td>
                    <td data-label={tx('manage.customers.colTier')}>
                      <Select
                        ariaLabel={tx('manage.customers.colTier')}
                        value={customer.tier}
                        options={TIERS.map((tier) => ({ value: tier, label: tier }))}
                        onChange={(value) =>
                          update((c) => setCustomer(c, customer.id, { tier: value as Tier }))}
                      />
                    </td>
                    <td className="ext-num" data-label={tx('manage.customers.colTasks')}>
                      {counts[customer.id] ?? 0}
                    </td>
                    <td className="ext-rowactions">
                      <TwoStepRemove
                        onRemove={() => update((c) => removeCustomer(c, customer.id))}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      <p className="ext-hint">{tx('manage.customers.hint')}</p>

      <section className="card ext-unlinked">
        <h2 className="ext-cardtitle">{tx('manage.customers.unlinked')}</h2>
        {unlinked.length === 0
          ? <p className="ext-hint">{tx('manage.customers.unlinkedNone')}</p>
          : (
            <ul className="chiprow ext-unlinkedlist">
              {unlinked.map((name) => (
                <li key={name}>
                  <span className="ext-labelchip">@{name}</span>
                  <button
                    className="btn sm"
                    onClick={() => update((current) => addCustomer(current, name, name))}
                  >
                    {tx('manage.customers.register')}
                  </button>
                </li>
              ))}
            </ul>
          )}
      </section>
    </div>
  );
}

/** A stage's tone, as a Todoist colour name the app can already draw. */
function toneColor(tone: string): string {
  const colors: Record<string, string> = {
    blue: 'blue', green: 'green', amber: 'orange', red: 'red', gray: 'charcoal',
  };
  return colors[tone] ?? 'charcoal';
}
