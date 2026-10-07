import { PageHeader } from '@/components/PageHeader';
import type { LoadSummary } from '@/domain/load';
import type { Route } from '@/hooks/useRoute';
import { isExtView } from './routes';
import { useTx } from './i18n';

/**
 * Nothing on these pages is estimated yet, so the metrics line has nothing to
 * say. `percentage: null` keeps the capacity pill off it.
 */
const EMPTY_LOAD: LoadSummary = {
  taskCount: 0,
  estimatedMinutes: 0,
  unestimatedCount: 0,
  percentage: null,
  level: null,
};

export interface ExtPageProps {
  route: Route;
  /** Opens a task in the detail panel. The real pages take it up from Phase 4. */
  onOpen: (id: string) => void;
}

/**
 * The one page component the fork hands to `App.tsx`: it picks the view itself,
 * so a new page is a case here rather than another line upstream.
 */
export function ExtPage({ route }: ExtPageProps) {
  const { tx } = useTx();
  if (!isExtView(route.view)) return null;

  return (
    /* `page` and `empty` are upstream's own page frame and empty state, so
       these placeholders already sit where the real pages will. */
    <div className="page ext-page">
      <PageHeader
        title={tx(`page.${route.view}.title`)}
        subtitle={tx(`page.${route.view}.soon`)}
        load={EMPTY_LOAD}
      />
      <p className="empty">{tx('page.placeholder')}</p>
    </div>
  );
}
