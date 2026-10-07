import { useMemo } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { format } from 'date-fns';
import { endOfWeek, startOfWeek } from 'date-fns';
import type { LoadSummary } from '@/domain/load';
import { useData } from '@/hooks/useData';
import { useToday } from '@/hooks/useToday';
import { setCustomerOrder } from '@/ext/data/actions';
import { useExt } from '@/ext/data/store';
import {
  PERIODS, customerTasks, engagementVisible, engagementsOf, inPeriod, shownCustomers,
  summarise, weekStartOf, type CustomerCardData, type CustomerPeriod,
} from '@/ext/domain/customers';
import { useCustomersViewPrefs } from '@/ext/hooks/useViewPrefs';
import { useTx } from '@/ext/i18n';
import { CustomerCard } from './CustomerCard';
import { CustomersToolbar } from './toolbar';

const EMPTY_LOAD: LoadSummary = {
  taskCount: 0, estimatedMinutes: 0, unestimatedCount: 0, percentage: null, level: null,
};

/**
 * Every customer, and what is on for them in the period being shown.
 *
 * The rules live in src/ext/domain/customers.ts and are tested there; this is
 * the page that arranges them. Task rows are upstream's `TaskRow`, so they
 * complete, open and drag exactly as they do everywhere else.
 */
export function CustomersPage({ onOpen }: { onOpen: (id: string) => void }) {
  const { tx } = useTx();
  const now = useToday();
  const { snapshot, items, childrenOf } = useData();
  const data = useExt((state) => state.data);
  const update = useExt((state) => state.update);
  const [prefs, setPrefs] = useCustomersViewPrefs();

  const weekStartsOn = weekStartOf(snapshot.user?.start_day);
  const { settings } = data;

  /* Every customer's cards, for the period on screen. Built once and used for
     both the list and the header's counts, so the two cannot disagree. */
  const cardsFor = useMemo(() => (period: CustomerPeriod): CustomerCardData[] => {
    const customers = shownCustomers(data.customers, data.customerOrder, {
      excluded: prefs.excluded, filters: prefs.filters, sort: prefs.sort,
    });
    return customers.map((customer) => {
      const all = engagementsOf(items, customer, settings);
      return {
        customer,
        tasks: customerTasks(items, customer, period, now, settings, 'week')
          .filter((task) => inPeriod(task, period, now, 'week', weekStartsOn)),
        engagements: all.filter((engagement) => engagementVisible(
          engagement, period, prefs.showEngagements, now,
          settings.soonDays, childrenOf(engagement.id),
        )),
      };
    });
  }, [data.customers, data.customerOrder, prefs.excluded, prefs.filters, prefs.sort,
    prefs.showEngagements, items, settings, now, weekStartsOn, childrenOf]);

  const cards = useMemo(() => cardsFor(prefs.period), [cardsFor, prefs.period]);

  /* A count per period for the segmented control, so the choice says what is
     behind it before it is made. */
  const counts = useMemo(() => Object.fromEntries(
    PERIODS.map((period) => [period, summarise(cardsFor(period)).tasks]),
  ) as Record<CustomerPeriod, number>, [cardsFor]);

  const shown = prefs.showEmpty
    ? cards
    : cards.filter((card) => card.tasks.length > 0 || card.engagements.length > 0);
  const totals = summarise(shown);

  const range = prefs.period === 'week'
    ? ` · ${format(startOfWeek(now, { weekStartsOn }), 'EEE d MMM')} to ${format(endOfWeek(now, { weekStartsOn }), 'EEE d MMM')}`
    : '';

  const subtitle = [
    tx('customers.subtitle.tasks', { count: totals.tasks }),
    tx('customers.subtitle.engagements', { count: totals.engagements }),
    tx('customers.subtitle.customers', { count: totals.customers }),
  ].join(' · ') + range;

  const filtered = cards.length === 0 && data.customers.length > 0;
  /* Customers exist, none of them has anything in this period, and the switch
     that would show them is off — so without this the page is simply blank,
     with nothing to say why or what to do about it. */
  const allQuiet = !filtered && shown.length === 0 && data.customers.length > 0;

  return (
    <div className="page ext-page ext-customers">
      <PageHeader title={tx('page.customers.title')} subtitle={subtitle} load={EMPTY_LOAD} />

      <CustomersToolbar
        prefs={prefs}
        setPrefs={setPrefs}
        customers={data.customers}
        csms={data.csms}
        stages={data.stages}
        counts={counts}
        order={data.customerOrder}
        onReorder={(order) => update((current) => setCustomerOrder(current, order))}
      />

      {data.customers.length === 0 && <p className="empty">{tx('customers.noCustomers')}</p>}

      {filtered && (
        <div className="empty">
          <p>{tx('customers.noMatches')}</p>
          <button
            className="btn sm"
            onClick={() => setPrefs({
              filters: { csms: [], stages: [], tiers: [] }, excluded: [],
            })}
          >
            {tx('customers.clearFilters')}
          </button>
        </div>
      )}

      {allQuiet && (
        <div className="empty">
          <p>{tx('customers.allQuiet')}</p>
          <button className="btn sm" onClick={() => setPrefs({ showEmpty: true })}>
            {tx('customers.showEmpty')}
          </button>
        </div>
      )}

      {shown.map((card) => (
        <CustomerCard
          key={card.customer.id}
          customer={card.customer}
          tasks={card.tasks}
          engagements={card.engagements}
          childrenOf={childrenOf}
          onOpen={onOpen}
          settings={settings}
          csm={data.csms.find((entry) => entry.id === card.customer.csm)}
          stage={data.stages.find((entry) => entry.id === card.customer.stage)}
          period={prefs.period}
          now={now}
          weekStartsOn={weekStartsOn}
          engagementIds={new Set(engagementsOf(items, card.customer, settings).map((e) => e.id))}
        />
      ))}
    </div>
  );
}
