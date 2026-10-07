import { useState } from 'react';
import { Icon } from '@/components/Icon';
import { TaskRow } from '@/components/TaskRow';
import { markerStyle } from '@/domain/colors';
import type { Item } from '@/domain/types';
import type { Csm, Customer, ExtSettings, Stage } from '@/ext/data/types';
import { initialsOf, type CustomerPeriod, type WeekStart } from '@/ext/domain/customers';
import { useTx } from '@/ext/i18n';
import { Composer } from './Composer';
import { EngagementCard } from './EngagementCard';

const TONE_COLORS: Record<string, string> = {
  blue: 'blue', green: 'green', amber: 'orange', red: 'red', gray: 'charcoal',
};

/** One customer: who they are, their engagements, and their loose tasks. */
export function CustomerCard({
  customer, tasks, engagements, childrenOf, onOpen, settings, csm, stage,
  period, now, weekStartsOn, engagementIds,
}: {
  customer: Customer;
  tasks: Item[];
  engagements: Item[];
  childrenOf: (id: string) => Item[];
  onOpen: (id: string) => void;
  settings: ExtSettings;
  csm: Csm | undefined;
  stage: Stage | undefined;
  period: CustomerPeriod;
  now: Date;
  weekStartsOn: WeekStart;
  /** Every engagement of this customer, shown or not, for the chip below. */
  engagementIds: Set<string>;
}) {
  const { tx } = useTx();
  const [open, setOpen] = useState(true);
  const [adding, setAdding] = useState(false);

  const count = tasks.length + engagements.length;

  return (
    <section className="card ext-customer">
      <div className="ext-custhead">
        <span className="ext-mark" style={markerStyle(customer.color)}>
          {initialsOf(customer.name)}
        </span>
        <span className="ext-custname">{customer.name}</span>
        <span className="chip ext-tier">{customer.tier}</span>
        {stage && (
          <span className="chip ext-stage" style={markerStyle(TONE_COLORS[stage.tone] ?? 'charcoal')}>
            {stage.name}
          </span>
        )}
        {csm && <span className="ext-hint ext-csm">{csm.name}</span>}
        <span className="ext-count">{count}</span>
        <button
          className="iconbtn"
          aria-label={tx('customers.add', { name: customer.name })}
          onClick={() => { setAdding(true); setOpen(true); }}
        >
          <Icon name="plus" size="sm" />
        </button>
        <button
          className="iconbtn"
          aria-expanded={open}
          aria-label={tx('customers.collapse')}
          onClick={() => setOpen(!open)}
        >
          <Icon name={open ? 'caret-up' : 'caret'} size="sm" />
        </button>
      </div>

      {open && (
        <>
          {adding && (
            <Composer
              customer={customer}
              settings={settings}
              onDone={() => setAdding(false)}
            />
          )}

          {engagements.map((engagement) => (
            <EngagementCard
              key={engagement.id}
              engagement={engagement}
              children={childrenOf(engagement.id)}
              childrenOf={childrenOf}
              onOpen={onOpen}
              customer={customer}
              settings={settings}
              period={period}
              now={now}
              weekStartsOn={weekStartsOn}
            />
          ))}

          {tasks.map((task) => (
            <div className="ext-taskline" key={task.id}>
              <TaskRow
                item={task}
                childrenOf={childrenOf}
                onOpen={onOpen}
                showProject={false}
              />
              {/* Its engagement is hidden in this period, so the row says
                  where it belongs rather than looking loose. */}
              {task.parent_id && engagementIds.has(task.parent_id)
                && !engagements.some((e) => e.id === task.parent_id) && (
                <span className="chip ext-engchip">{tx('customers.inEngagement')}</span>
              )}
            </div>
          ))}

          {count === 0 && !adding && <p className="ext-hint">{tx('customers.noTasks')}</p>}
        </>
      )}
    </section>
  );
}
