import { useState } from 'react';
import { startOfDay } from 'date-fns';
import { Icon } from '@/components/Icon';
import { TaskRow } from '@/components/TaskRow';
import { formatRelativeDay } from '@/domain/dates';
import type { Item } from '@/domain/types';
import { useT } from '@/hooks/useT';
import type { Customer, ExtSettings } from '@/ext/data/types';
import {
  daysUntil, engagementProgress, inPeriod, type CustomerPeriod, type WeekStart,
} from '@/ext/domain/customers';
import { useTx } from '@/ext/i18n';
import { Composer } from './Composer';

/**
 * One engagement: what it is, how far along, when it is due, and the tasks
 * inside it that fall in the period being shown.
 *
 * The rows are `TaskRow`, so ticking one off, opening it and dragging it
 * behave exactly as they do on every other page.
 */
export function EngagementCard({
  engagement, children, childrenOf, onOpen, customer, settings, period, now, weekStartsOn,
}: {
  engagement: Item;
  children: Item[];
  childrenOf: (id: string) => Item[];
  onOpen: (id: string) => void;
  customer: Customer;
  settings: ExtSettings;
  period: CustomerPeriod;
  now: Date;
  weekStartsOn: WeekStart;
}) {
  const { tx } = useTx();
  const { locale } = useT();
  const [open, setOpen] = useState(true);
  const [adding, setAdding] = useState(false);

  const progress = engagementProgress(children);
  const days = daysUntil(engagement, now);
  const late = days !== null && days < 0;
  const dueToday = days === 0;
  const date = engagement.deadline?.date ?? engagement.due?.date ?? null;

  /* The period filters what is shown inside the card as well: an engagement
     on Today shows what is due today, not its whole backlog. */
  const shown = children.filter((child) =>
    !child.checked && inPeriod(child, period, now, 'week', weekStartsOn));

  return (
    <article className={`ext-engagement${late ? ' late' : dueToday ? ' today' : ''}`}>
      <div className="ext-enghead">
        <button
          className="ext-engtoggle"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          <Icon name={open ? 'caret-up' : 'caret'} size="sm" />
        </button>
        <span className="ext-engtitle">{engagement.content}</span>
        {date && (
          <span className={`chip ext-deadline${late ? ' late' : ''}`}>
            <Icon name="deadline" size="sm" />
            {formatRelativeDay(startOfDay(new Date(date)), locale, now)}
          </span>
        )}
        <span className="ext-hint">
          {tx('customers.progress', { done: progress.done, total: progress.total })}
        </span>
      </div>

      {progress.total > 0 && (
        <div className="ext-progress" role="presentation">
          <span style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }} />
        </div>
      )}

      {open && (
        <>
          {shown.map((child) => (
            <TaskRow
              key={child.id}
              item={child}
              childrenOf={childrenOf}
              onOpen={onOpen}
              showProject={false}
            />
          ))}

          {adding
            ? (
              <Composer
                customer={customer}
                settings={settings}
                parentId={engagement.id}
                kind="task"
                onDone={() => setAdding(false)}
              />
            )
            : (
              <button className="btn sm quiet ext-addtask" onClick={() => setAdding(true)}>
                <Icon name="plus" size="sm" />
                {tx('customers.addTask')}
              </button>
            )}
        </>
      )}
    </article>
  );
}
