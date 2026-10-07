import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { useRoute, type Route } from '@/hooks/useRoute';
import { EXT_VIEWS, isExtView } from './routes';

/**
 * Reads what `useRoute` makes of a hash.
 *
 * The parser itself is private to the hook, and the unit tests run in Node
 * with no DOM (`vitest.config.ts`), so the hook is rendered on the server
 * instead: `useState`'s initialiser runs the real parser, while the effect that
 * subscribes to `hashchange` does not run at all, which is why a bare
 * `location` is enough of a window.
 */
function routeFor(hash: string): Route {
  const previous = (globalThis as { window?: unknown }).window;
  (globalThis as { window?: unknown }).window = { location: { hash } };
  let seen: Route | undefined;
  try {
    const Probe = () => {
      seen = useRoute();
      return null;
    };
    renderToStaticMarkup(createElement(Probe));
  } finally {
    if (previous === undefined) delete (globalThis as { window?: unknown }).window;
    else (globalThis as { window?: unknown }).window = previous;
  }
  return seen!;
}

describe('EXT_VIEWS', () => {
  it('names the five pages the fork adds', () => {
    expect(EXT_VIEWS).toEqual(['customers', 'objectives', 'initiatives', 'goals', 'manage']);
  });

  it('recognises its own views and nothing else', () => {
    for (const view of EXT_VIEWS) expect(isExtView(view)).toBe(true);
    for (const view of ['week', 'labels', 'insights', 'customer', '']) {
      expect(isExtView(view)).toBe(false);
    }
  });
});

describe('routing the fork’s pages', () => {
  it('parses #/customers', () => {
    expect(routeFor('#/customers')).toEqual({ view: 'customers' });
  });

  it('keeps the tab on #/manage/goals', () => {
    expect(routeFor('#/manage/goals')).toEqual({
      view: 'manage',
      id: 'goals',
      sectionId: undefined,
    });
  });

  it('parses every ext view', () => {
    for (const view of EXT_VIEWS) expect(routeFor(`#/${view}`)).toEqual({ view });
  });

  /* The fork must not widen what the router accepts beyond its own pages. */
  it('still falls back to the week for an unknown view', () => {
    expect(routeFor('#/customer')).toEqual({ view: 'week' });
  });
});
