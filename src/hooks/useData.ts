import { useMemo } from 'react';
import { useStore } from '@/store/store';
import { childIndex, makeChildrenOf, openItems } from '@/store/selectors';
import type { Item } from '@/domain/types';
import { useHiddenProjects } from '@/ext/hooks/useHiddenProjects'; // ext:

/**
 * The derived reading of the snapshot every view needs: the open tasks, and a
 * way to reach a task's children. Recomputed only when the snapshot changes.
 */
export function useData() {
  const storage = useStore((s) => s.prefs.estimateStorage);
  const snapshot = useStore((s) => s.snapshot);
  // ext: projects the fork keeps out of every list (src/ext/domain/projects.ts)
  const hide = useHiddenProjects(snapshot);

  return useMemo(() => {
    void storage; // Changing precedence invalidates derived totals and groups.
    const index = childIndex(snapshot);
    const childrenOf = makeChildrenOf(index);
    const items = hide(openItems(snapshot)); // ext:
    const byId = (id: string): Item | undefined => snapshot.items[id];
    return { snapshot, items, childrenOf, byId, childIndex: index };
  }, [snapshot, storage, hide]); // ext: hide
}
