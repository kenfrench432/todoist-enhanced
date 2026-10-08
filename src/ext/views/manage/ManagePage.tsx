import { useMemo } from 'react';
import { PageHeader } from '@/components/PageHeader';
import type { LoadSummary } from '@/domain/load';
import { navigate, type Route } from '@/hooks/useRoute';
import { useData } from '@/hooks/useData';
import { useExt } from '@/ext/data/store';
import { initiativesIn } from '@/ext/domain/initiatives';
import { pendingChanges } from '@/ext/domain/rules';
import { useTx, type ExtKey } from '@/ext/i18n';
import { CustomersTab } from './CustomersTab';
import { GoalsTab } from './GoalsTab';
import { InitiativesTab } from './InitiativesTab';
import { RulesTab } from './RulesTab';

const TABS = ['customers', 'goals', 'initiatives', 'rules'] as const;
type Tab = (typeof TABS)[number];

const EMPTY_LOAD: LoadSummary = {
  taskCount: 0, estimatedMinutes: 0, unestimatedCount: 0, percentage: null, level: null,
};

const isTab = (value: string | undefined): value is Tab =>
  TABS.includes(value as Tab);

/**
 * Where the fork's own data is set up: customers and the lists behind them,
 * goals and their KPIs, and the initiatives bound to Todoist tasks.
 *
 * The tab is in the address, so a link can land on one directly and Back
 * walks between them.
 */
export function ManagePage({ route }: { route: Route }) {
  const { tx } = useTx();
  const { snapshot, items } = useData();
  const data = useExt((state) => state.data);
  const tab: Tab = isTab(route.id) ? route.id : 'customers';

  /* A count under each tab name, so the page says what is in it before you
     have opened anything. */
  /* Rules count what they would change rather than how many rules there are:
     the number worth seeing from the other tabs is the size of the mess. */
  const counts = useMemo(() => ({
    customers: data.customers.length,
    goals: data.goals.length,
    initiatives: initiativesIn(items, data.settings).length,
    rules: pendingChanges(items, data.rules).length,
  }), [data.customers.length, data.goals.length, data.settings, data.rules, items]);

  return (
    <div className="page ext-page ext-manage">
      <PageHeader
        title={tx('page.manage.title')}
        subtitle={tx('page.manage.soon')}
        load={EMPTY_LOAD}
      />

      <div className="tabs" role="tablist">
        {TABS.map((value) => (
          <button
            key={value}
            role="tab"
            aria-selected={tab === value}
            onClick={() => navigate('manage', value === 'customers' ? undefined : value)}
          >
            {tx(`manage.tab.${value}` as ExtKey)}
            <span className="ext-tabcount">{counts[value]}</span>
          </button>
        ))}
      </div>

      {tab === 'customers' && <CustomersTab data={data} snapshot={snapshot} items={items} />}
      {tab === 'goals' && <GoalsTab data={data} items={items} />}
      {tab === 'initiatives' && <InitiativesTab data={data} items={items} />}
      {tab === 'rules' && <RulesTab data={data} snapshot={snapshot} items={items} />}
    </div>
  );
}
