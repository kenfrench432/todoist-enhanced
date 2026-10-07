import type { Item, Project } from '@/domain/types';

/**
 * Projects kept out of this app.
 *
 * Not archived in Todoist — archiving hides them there too. These are projects
 * that still exist and still get used; they simply have no business on a page
 * about customer work.
 */

/**
 * The excluded projects, plus everything nested under them.
 *
 * Todoist projects nest, and hiding "Personal" while a sub-project of it keeps
 * appearing would read as a bug rather than a setting. Walked rather than
 * computed from one level, so a grandchild is caught too.
 */
export function expandExcluded(
  projects: Record<string, Project>,
  excluded: string[],
): Set<string> {
  const out = new Set(excluded.filter((id) => id));
  /* A parent that points at its own descendant would otherwise loop forever.
     Todoist should never send one, which is exactly why it is worth not
     trusting. */
  let changed = true;
  let guard = 0;
  while (changed && guard < 50) {
    changed = false;
    guard += 1;
    for (const project of Object.values(projects)) {
      if (project.is_deleted || out.has(project.id)) continue;
      if (project.parent_id && out.has(project.parent_id)) {
        out.add(project.id);
        changed = true;
      }
    }
  }
  return out;
}

/**
 * The tasks a list should show.
 *
 * A hidden project's tasks are dropped — **except on that project's own
 * page**. Without the exception the project row in the sidebar would open an
 * empty page, which is a worse answer than simply not listing its tasks
 * elsewhere.
 */
export function visibleItems(
  items: Item[],
  excluded: ReadonlySet<string>,
  openProjectId?: string | null,
): Item[] {
  if (excluded.size === 0) return items;
  return items.filter((item) =>
    !excluded.has(item.project_id) || item.project_id === openProjectId);
}

/** The projects offered in the picker: real projects, not folders or the Inbox. */
export function pickableProjects(
  projects: Record<string, Project>,
  inboxId: string | undefined,
): Project[] {
  return Object.values(projects)
    .filter((project) => !project.is_deleted && !project.is_archived)
    .filter((project) => !project.is_folder && project.id !== inboxId)
    .sort((a, b) => a.name.localeCompare(b.name));
}
