import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from '@/components/Icon';
import type { Csm, Customer, Stage, Tier } from '@/ext/data/types';
import {
  PERIODS, activeFilterCount, type CustomerFilters, type CustomerPeriod, type CustomerSort,
} from '@/ext/domain/customers';
import { useTx, type ExtKey } from '@/ext/i18n';
import type { CustomersViewPrefs } from '@/ext/hooks/useViewPrefs';

/**
 * A popover that closes on a click outside and on Escape, and gives the focus
 * back to the button that opened it — the rules in docs/component-language.md,
 * and the same mechanics as upstream's Display menu.
 */
function Popover(
  { label, count, children }: { label: string; count?: number; children: ReactNode },
) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="pop-wrap" ref={wrap}>
      <button
        className="btn"
        ref={trigger}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
      >
        {label}
        {count !== undefined && count > 0 && <span className="displaycount">{count}</span>}
        <Icon name="caret" size="sm" />
      </button>
      {open && <div className="pop open ext-pop">{children}</div>}
    </div>
  );
}

/** A line in a popover that can be ticked. */
function CheckLine(
  { on, label, onToggle }: { on: boolean; label: string; onToggle: () => void },
) {
  return (
    <button className="ext-popline" role="menuitemcheckbox" aria-checked={on} onClick={onToggle}>
      <span className={`ext-tick${on ? ' on' : ''}`}>{on && <Icon name="check" size="sm" />}</span>
      <span className="ext-popline-label">{label}</span>
    </button>
  );
}

/** The app's own switch, with its words beside it. */
function Switch({ on, label, onToggle }: { on: boolean; label: string; onToggle: () => void }) {
  return (
    <span className="ext-switch">
      <button
        type="button"
        className="switch"
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={onToggle}
      />
      <button type="button" className="ext-switchlabel" onClick={onToggle} tabIndex={-1}>
        {label}
      </button>
    </span>
  );
}

const toggle = (list: string[], value: string): string[] =>
  (list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value]);

export function CustomersToolbar({
  prefs, setPrefs, customers, csms, stages, counts, order, onReorder,
}: {
  prefs: CustomersViewPrefs;
  setPrefs: (patch: Partial<CustomersViewPrefs>) => void;
  customers: Customer[];
  csms: Csm[];
  stages: Stage[];
  /** Open tasks per period, for the segmented control. */
  counts: Record<CustomerPeriod, number>;
  order: string[];
  onReorder: (order: string[]) => void;
}) {
  const { tx } = useTx();
  const filterCount = activeFilterCount(prefs.filters);

  const setFilters = (patch: Partial<CustomerFilters>) =>
    setPrefs({ filters: { ...prefs.filters, ...patch } });

  /* The customers popover lists them in the order the page shows them, so
     moving one up here moves it up there. */
  const ordered = prefs.sort === 'custom'
    ? [...customers].sort((a, b) => {
      const rank = (id: string) => {
        const index = order.indexOf(id);
        return index === -1 ? Number.MAX_SAFE_INTEGER : index;
      };
      return rank(a.id) - rank(b.id) || a.name.localeCompare(b.name);
    })
    : [...customers].sort((a, b) => a.name.localeCompare(b.name));

  const move = (id: string, delta: number) => {
    const ids = ordered.map((customer) => customer.id);
    const from = ids.indexOf(id);
    const to = from + delta;
    if (from === -1 || to < 0 || to >= ids.length) return;
    const next = [...ids];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onReorder(next);
  };

  return (
    <div className="toolbar ext-toolbar">
      <div className="segmented small" aria-label={tx('customers.period')}>
        {PERIODS.map((period) => (
          <button
            key={period}
            aria-pressed={prefs.period === period}
            onClick={() => setPrefs({ period })}
          >
            {tx(`customers.period.${period}` as ExtKey)}
            <small>{counts[period]}</small>
          </button>
        ))}
      </div>

      <Popover
        label={tx('customers.whichCustomers')}
        count={prefs.excluded.length}
      >
        <h4>{tx('customers.whichCustomers')}</h4>
        <div className="ext-poprow">
          <button className="btn sm quiet" onClick={() => setPrefs({ excluded: [] })}>
            {tx('customers.all')}
          </button>
          <button
            className="btn sm quiet"
            onClick={() => setPrefs({ excluded: customers.map((c) => c.id) })}
          >
            {tx('customers.none')}
          </button>
        </div>
        <div className="ext-poplist">
          {ordered.map((customer) => (
            <div className="ext-popline-wrap" key={customer.id}>
              <CheckLine
                on={!prefs.excluded.includes(customer.id)}
                label={customer.name}
                onToggle={() => setPrefs({ excluded: toggle(prefs.excluded, customer.id) })}
              />
              {prefs.sort === 'custom' && (
                <span className="ext-ordertools">
                  <button
                    className="iconbtn"
                    aria-label={`${tx('customers.moveUp')} ${customer.name}`}
                    onClick={() => move(customer.id, -1)}
                  >
                    <Icon name="caret-up" size="sm" />
                  </button>
                  <button
                    className="iconbtn"
                    aria-label={`${tx('customers.moveDown')} ${customer.name}`}
                    onClick={() => move(customer.id, 1)}
                  >
                    <Icon name="caret" size="sm" />
                  </button>
                </span>
              )}
            </div>
          ))}
        </div>
        <h4>{tx('customers.sort')}</h4>
        <div className="segmented small">
          {(['az', 'custom'] as CustomerSort[]).map((sort) => (
            <button
              key={sort}
              aria-pressed={prefs.sort === sort}
              onClick={() => setPrefs({ sort })}
            >
              {tx(`customers.sort.${sort}` as ExtKey)}
            </button>
          ))}
        </div>
      </Popover>

      <Popover label={tx('customers.filters')} count={filterCount}>
        <h4>{tx('manage.customers.colCsm')}</h4>
        <div className="ext-poplist">
          {csms.map((csm) => (
            <CheckLine
              key={csm.id}
              on={prefs.filters.csms.includes(csm.id)}
              label={csm.name}
              onToggle={() => setFilters({ csms: toggle(prefs.filters.csms, csm.id) })}
            />
          ))}
          {csms.length === 0 && <p className="ext-hint">{tx('manage.customers.noCsms')}</p>}
        </div>

        <h4>{tx('manage.customers.colStage')}</h4>
        <div className="ext-poplist">
          {stages.map((stage) => (
            <CheckLine
              key={stage.id}
              on={prefs.filters.stages.includes(stage.id)}
              label={stage.name}
              onToggle={() => setFilters({ stages: toggle(prefs.filters.stages, stage.id) })}
            />
          ))}
        </div>

        <h4>{tx('manage.customers.colTier')}</h4>
        <div className="ext-poplist">
          {(['P1', 'P2', 'P3'] as Tier[]).map((tier) => (
            <CheckLine
              key={tier}
              on={prefs.filters.tiers.includes(tier)}
              label={tier}
              onToggle={() => setFilters({ tiers: toggle(prefs.filters.tiers, tier) })}
            />
          ))}
        </div>

        {filterCount > 0 && (
          <div className="pop-foot">
            <button
              className="btn sm quiet"
              onClick={() => setPrefs({ filters: { csms: [], stages: [], tiers: [] } })}
            >
              {tx('customers.clearFilters')}
            </button>
          </div>
        )}
      </Popover>

      {/* Upstream's switch is a role="switch" button with the toggle drawn by
          .switch, and the words beside it — not a label wrapping a checkbox,
          which would be squeezed into the 38px the class gives it. */}
      <Switch
        on={prefs.showEngagements}
        label={tx('customers.showEngagements')}
        onToggle={() => setPrefs({ showEngagements: !prefs.showEngagements })}
      />
      <Switch
        on={prefs.showEmpty}
        label={tx('customers.showEmpty')}
        onToggle={() => setPrefs({ showEmpty: !prefs.showEmpty })}
      />
    </div>
  );
}
