import { useState } from 'react';
import { addDays, addMonths, addWeeks, endOfWeek, startOfDay } from 'date-fns';
import { toApiDate } from '@/domain/dates';
import { useData } from '@/hooks/useData';
import { useToday } from '@/hooks/useToday';
import { useStore } from '@/store/store';
import type { Customer, ExtSettings } from '@/ext/data/types';
import { composerLabels, weekStartOf } from '@/ext/domain/customers';
import { useTx, type ExtKey } from '@/ext/i18n';

type Kind = 'task' | 'engagement';
const DUE_CHOICES = ['today', 'tomorrow', 'week', 'none'] as const;
const DEADLINE_CHOICES = ['1w', '2w', '1m', 'none'] as const;
type Due = (typeof DUE_CHOICES)[number];
type Deadline = (typeof DEADLINE_CHOICES)[number];

/** The date a due chip means. "This week" is the end of the user's own week. */
function dueDateFor(choice: Due, today: Date, weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6) {
  switch (choice) {
    case 'today': return toApiDate(today);
    case 'tomorrow': return toApiDate(addDays(today, 1));
    case 'week': return toApiDate(startOfDay(endOfWeek(today, { weekStartsOn })));
    default: return null;
  }
}

const deadlineFor = (choice: Deadline, today: Date) => {
  switch (choice) {
    case '1w': return toApiDate(addWeeks(today, 1));
    case '2w': return toApiDate(addWeeks(today, 2));
    case '1m': return toApiDate(addMonths(today, 1));
    default: return null;
  }
};

/**
 * The inline composer a customer card's "+" opens.
 *
 * A task and an engagement are the same form with a different date field and
 * one more label, so they are one component with a toggle rather than two that
 * drift. The labels it will apply are on screen before anything is created —
 * nobody should have to type an `@`, and nobody should have to guess either.
 */
export function Composer({
  customer, settings, parentId, kind: fixedKind, onDone,
}: {
  customer: Customer;
  settings: ExtSettings;
  /** Set when adding a task inside an engagement: it becomes a sub-task. */
  parentId?: string;
  /** Fixes the kind, for the sub-task field inside an engagement. */
  kind?: Kind;
  onDone: () => void;
}) {
  const { tx } = useTx();
  const today = useToday();
  const { snapshot } = useData();
  const createTask = useStore((s) => s.createTask);
  const toast = useStore((s) => s.toast);

  const [kind, setKind] = useState<Kind>(fixedKind ?? 'task');
  const [title, setTitle] = useState('');
  const [due, setDue] = useState<Due>('today');
  const [deadline, setDeadline] = useState<Deadline>('1w');
  const [priority, setPriority] = useState(1);

  const weekStartsOn = weekStartOf(snapshot.user?.start_day);
  const labels = composerLabels(kind, customer, settings);

  const submit = async () => {
    const content = title.trim();
    if (!content) return;
    const dueOn = kind === 'task' ? dueDateFor(due, today, weekStartsOn) : null;
    const deadlineOn = kind === 'engagement' ? deadlineFor(deadline, today) : null;

    await createTask({
      content,
      /* A sub-task belongs to its parent's project, so the setting only
         decides where a new top-level task lands. */
      ...(parentId
        ? { parent_id: parentId }
        : { project_id: settings.customersProjectId ?? snapshot.user?.inbox_project_id }),
      labels,
      priority,
      ...(dueOn ? { due: { date: dueOn } } : {}),
      ...(deadlineOn ? { deadline: { date: deadlineOn, lang: 'en' } } : {}),
    });

    toast(tx('composer.added', { title: content, customer: customer.name, label: customer.label }));
    setTitle('');
    onDone();
  };

  const chips = <T extends string>(
    values: readonly T[], current: T, pick: (value: T) => void, keyOf: (value: T) => ExtKey,
  ) => (
    <div className="chiprow ext-composerchips">
      {values.map((value) => (
        <button
          key={value}
          className={`chip${current === value ? ' on' : ''}`}
          aria-pressed={current === value}
          onClick={() => pick(value)}
        >
          {tx(keyOf(value))}
        </button>
      ))}
    </div>
  );

  return (
    <div className="ext-composer">
      {!fixedKind && (
        <div className="segmented small ext-kind">
          {(['task', 'engagement'] as Kind[]).map((value) => (
            <button key={value} aria-pressed={kind === value} onClick={() => setKind(value)}>
              {tx(`composer.${value}` as ExtKey)}
            </button>
          ))}
        </div>
      )}

      <div className="ext-addrow">
        <input
          className="textfield"
          autoFocus
          placeholder={tx(kind === 'task' ? 'composer.titleTask' : 'composer.titleEngagement')}
          aria-label={tx(kind === 'task' ? 'composer.titleTask' : 'composer.titleEngagement')}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void submit();
            if (event.key === 'Escape') onDone();
          }}
        />
        <button className="btn primary" disabled={!title.trim()} onClick={() => void submit()}>
          {tx('composer.add')}
        </button>
        <button className="btn quiet" onClick={onDone}>{tx('composer.cancel')}</button>
      </div>

      {kind === 'task'
        ? chips(DUE_CHOICES, due, setDue, (value) => `composer.due.${value}` as ExtKey)
        : chips(
          DEADLINE_CHOICES, deadline, setDeadline,
          (value) => `composer.deadline.${value}` as ExtKey,
        )}

      {kind === 'task' && (
        <div className="chiprow ext-composerchips">
          {[4, 3, 2, 1].map((value) => (
            <button
              key={value}
              className={`chip${priority === value ? ' on' : ''}`}
              aria-pressed={priority === value}
              aria-label={`${tx('composer.priority')} P${5 - value}`}
              onClick={() => setPriority(value)}
            >
              P{5 - value}
            </button>
          ))}
        </div>
      )}

      <p className="ext-hint">
        {tx('composer.labels')}{' '}
        {labels.map((label) => <code className="ext-labelchip" key={label}>@{label}</code>)}
      </p>
    </div>
  );
}
