import { useCallback, useMemo } from 'react';
import type { Item, Snapshot } from '@/domain/types';
import { useRoute } from '@/hooks/useRoute';
import { useExt } from '@/ext/data/store';
import { expandExcluded, visibleItems } from '@/ext/domain/projects';

/**
 * A filter that drops the tasks of projects this app hides.
 *
 * A hook rather than a plain function on purpose: the app has to re-render
 * when the list changes, which reading `useExt.getState()` would not do. It
 * also watches the route, so a hidden project's own page still shows its
 * tasks and its sidebar row is never a dead end.
 */
export function useHiddenProjects(snapshot: Snapshot): (items: Item[]) => Item[] {
  const excludedIds = useExt((state) => state.data.settings.excludedProjectIds);
  const route = useRoute();

  const excluded = useMemo(
    () => expandExcluded(snapshot.projects, excludedIds),
    [snapshot.projects, excludedIds],
  );
  const openProjectId = route.view === 'project' ? route.id ?? null : null;

  return useCallback(
    (items: Item[]) => visibleItems(items, excluded, openProjectId),
    [excluded, openProjectId],
  );
}
