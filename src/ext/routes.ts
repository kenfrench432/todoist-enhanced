/**
 * The pages this fork adds (see docs/ext/SPEC.md).
 *
 * The list lives here rather than in the upstream `ViewId` union so that
 * adding or renaming one of our pages never touches an upstream file: the
 * union spreads this, and the router's known list spreads it too.
 */
export const EXT_VIEWS = [
  'customers',
  'objectives',
  'initiatives',
  'goals',
  'manage',
] as const;

export type ExtViewId = (typeof EXT_VIEWS)[number];

/** Whether a route belongs to this fork, narrowing the view id as it goes. */
export function isExtView(view: string): view is ExtViewId {
  return (EXT_VIEWS as readonly string[]).includes(view);
}
