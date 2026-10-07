import { describe, expect, it } from 'vitest';
import type { Project } from '@/domain/types';
import { item } from '@/test/items';
import { expandExcluded, pickableProjects, visibleItems } from './projects';

const project = (id: string, over: Partial<Project> = {}): Project => ({
  id, name: id, color: 'charcoal', parent_id: null, child_order: 1,
  is_archived: false, is_deleted: false, is_favorite: false, ...over,
});

const tree = (): Record<string, Project> => ({
  personal: project('personal'),
  house: project('house', { parent_id: 'personal' }),
  garden: project('garden', { parent_id: 'house' }),
  work: project('work'),
});

describe('expandExcluded', () => {
  /* Hiding "Personal" while a sub-project of it keeps appearing would read as
     a bug rather than a setting. */
  it('takes the descendants with it, however deep', () => {
    expect([...expandExcluded(tree(), ['personal'])].sort())
      .toEqual(['garden', 'house', 'personal']);
  });

  it('takes only what is under the one named', () => {
    expect([...expandExcluded(tree(), ['house'])].sort()).toEqual(['garden', 'house']);
    expect([...expandExcluded(tree(), ['work'])]).toEqual(['work']);
  });

  it('is empty when nothing is excluded', () => {
    expect(expandExcluded(tree(), []).size).toBe(0);
    expect(expandExcluded(tree(), ['']).size).toBe(0);
  });

  it('ignores a project Todoist no longer has', () => {
    expect([...expandExcluded(tree(), ['gone'])]).toEqual(['gone']);
  });

  it('leaves a deleted project out of the walk', () => {
    const projects = { ...tree(), house: project('house', { parent_id: 'personal', is_deleted: true }) };
    expect([...expandExcluded(projects, ['personal']).values()].sort())
      .toEqual(['personal']);
  });

  /* Todoist should never send a cycle, which is exactly why it is worth not
     trusting it with an unbounded loop. */
  it('terminates on a cycle rather than hanging', () => {
    const cyclic = {
      a: project('a', { parent_id: 'b' }),
      b: project('b', { parent_id: 'a' }),
    };
    expect(() => expandExcluded(cyclic, ['a'])).not.toThrow();
    expect([...expandExcluded(cyclic, ['a'])].sort()).toEqual(['a', 'b']);
  });
});

describe('visibleItems', () => {
  const items = [
    item({ id: 'p1', project_id: 'personal' }),
    item({ id: 'w1', project_id: 'work' }),
    item({ id: 'h1', project_id: 'house' }),
  ];

  it('drops the tasks of a hidden project', () => {
    const hidden = expandExcluded(tree(), ['personal']);
    expect(visibleItems(items, hidden).map((i) => i.id)).toEqual(['w1']);
  });

  /* Otherwise the project row in the sidebar opens an empty page, which is a
     worse answer than simply not listing its tasks elsewhere. */
  it('shows them again on that project’s own page', () => {
    const hidden = expandExcluded(tree(), ['personal']);
    expect(visibleItems(items, hidden, 'personal').map((i) => i.id)).toEqual(['p1', 'w1']);
    expect(visibleItems(items, hidden, 'house').map((i) => i.id)).toEqual(['w1', 'h1']);
  });

  it('gives back the same list when nothing is hidden', () => {
    expect(visibleItems(items, new Set())).toBe(items);
  });
});

describe('pickableProjects', () => {
  it('offers real projects, A to Z', () => {
    const projects = {
      zed: project('zed', { name: 'Zed' }),
      acme: project('acme', { name: 'Acme' }),
    };
    expect(pickableProjects(projects, undefined).map((p) => p.name)).toEqual(['Acme', 'Zed']);
  });

  it('leaves out the Inbox, folders, and anything gone', () => {
    const projects = {
      inbox: project('inbox', { name: 'Inbox' }),
      folder: project('folder', { name: 'Folder', is_folder: true }),
      archived: project('archived', { name: 'Archived', is_archived: true }),
      deleted: project('deleted', { name: 'Deleted', is_deleted: true }),
      real: project('real', { name: 'Real' }),
    };
    expect(pickableProjects(projects, 'inbox').map((p) => p.name)).toEqual(['Real']);
  });
});
