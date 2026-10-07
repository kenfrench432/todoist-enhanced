import { useState } from 'react';
import { Icon, type IconName } from '@/components/Icon';
import type { ViewId } from '@/domain/types';
import { navigate } from '@/hooks/useRoute';
import { useTx, type ExtKey } from './i18n';
import type { ExtViewId } from './routes';

/**
 * The fork's sidebar rows, added after Labels (see docs/ext/SPEC.md "Sidebar").
 *
 * The markup and classes are copied from `navItem` and `SideGroup` in
 * `Sidebar.tsx` rather than imported: both are module-private there, and
 * exporting them would mean a second upstream change every merge. Copying the
 * classes keeps the rows looking like their neighbours with no upstream edit.
 *
 * No key hints and no drop targets: there are no `GO_KEYS` for these pages, and
 * nothing on them takes a dragged task yet.
 */
export function ExtNav({ current }: { current: ViewId }) {
  const { tx } = useTx();
  const [focusOpen, setFocusOpen] = useState(true);

  const item = (view: ExtViewId, icon: IconName, labelKey: ExtKey) => (
    <button
      key={view}
      className="navitem"
      aria-current={current === view ? 'page' : undefined}
      onClick={() => navigate(view)}
    >
      <Icon name={icon} />
      <span className="label">{tx(labelKey)}</span>
      {/* Counts land with the rules that compute them, in Phase 3 on. */}
    </button>
  );

  return (
    <nav className="ext-nav" aria-label={tx('nav.manage')}>
      {item('customers', 'stack', 'nav.customers')}

      <section className="side-group ext-group">
        <div className="side-head">
          <button
            className="side-headbtn"
            aria-expanded={focusOpen}
            onClick={() => setFocusOpen(!focusOpen)}
          >
            <span>{tx('nav.focus')}</span>
          </button>
          {/* The caret ends the row, as it does on every other sidebar group. */}
          <button
            className="side-disclose"
            aria-expanded={focusOpen}
            aria-label={tx('nav.focus')}
            onClick={() => setFocusOpen(!focusOpen)}
          >
            <Icon name={focusOpen ? 'caret-up' : 'caret'} size="sm" />
          </button>
        </div>
        {focusOpen && (
          <>
            {item('objectives', 'flag', 'nav.objectives')}
            {item('initiatives', 'board', 'nav.initiatives')}
            {item('goals', 'trend', 'nav.goals')}
          </>
        )}
      </section>

      {item('manage', 'sliders', 'nav.manage')}
    </nav>
  );
}
