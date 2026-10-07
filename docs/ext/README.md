# Extension docs

Ken's fork of Enhanced for Todoist adds five views for a Technical Success
Manager at Bynder: Customers, Manage, Initiatives, Goals & KPIs and Objectives.
All of its code lives under `src/ext/`, so upstream stays mergeable. The rules
of the fork are in [`../../CLAUDE.md`](../../CLAUDE.md).

Read in this order:

| Document | What it covers |
| --- | --- |
| [SPEC.md](SPEC.md) | What each view does, with its exact rules |
| [DATA-MODEL.md](DATA-MODEL.md) | How it maps onto Todoist labels, tasks and comments, plus the extension data the app stores itself |
| [BUILD-PLAN.md](BUILD-PLAN.md) | The eleven phases (0–10), one branch and one PR each |
| [mockup/](mockup/README.md) | The mockup's markup (`mockup.html`) and logic (`mockup-logic.js`), as a reference only |

Also useful:

- [`../component-language.md`](../component-language.md): the app's own UI rules
  (tokens, controls, popups). New UI follows it.
- [`../../UPDATING.md`](../../UPDATING.md): how upstream updates arrive and how
  to merge them.

The spec is the source of truth. If something turns out wrong in real use, edit
`SPEC.md` first, then bring the code in line with it.

## Known upstream issues

These are upstream's, not the fork's. They are on the Phase 0 baseline too, and
the rule in `CLAUDE.md` is to note them rather than fix them: a fix in an
upstream file is a merge conflict every week, and all three are harmless.

| Issue | What it is |
| --- | --- |
| `e2e/fixes-1.16.spec.ts:3` fails | "#117 a saved title opens as plain text" expects one `.nmark.priority` in the task panel and finds none. It fails identically at the Phase 0 baseline, so `npx playwright test` reads 107 passed, 1 failed. Treat that one as the expected state until an upstream release clears it. |
| 7 npm-audit vulnerabilities | 1 low, 2 moderate, 2 high, 2 critical, in `@vitest/mocker`, `brace-expansion`, `fast-uri`, `serialize-javascript`, `source-map-js`, `tinypool` and `vitest`. Every one is a transitive development dependency — the test runner, ESLint, the PWA plugin and Vite's own build — so none of them reach the browser bundle. Clearing `tinypool` needs `npm audit fix --force`, which installs a new major of Vitest; that is upstream's call. |
| Chunk-size warning on build | `npm run build` warns that `dist/assets/index-*.js` is over 500 kB (about 920 kB raw, 270 kB gzipped). The app is not code-split. Splitting it would touch `vite.config.ts`, which is not one of the fork's hook points. |

Re-check them against upstream after a sync, and delete a row once it is fixed.

## Writing demo data

`src/ext/demo.ts` seeds the sample account. Two things about it are easy to
get wrong:

- **Demo copy is part of the test surface.** Playwright matches an accessible
  name by substring, so a task called "Book the onboarding workshop" answers to
  upstream's `getByRole('button', { name: 'Board' })` and quietly hijacks its
  Upcoming journey. Run the whole suite, not only `ext-*`, after changing a
  task title.
- **The tasks land in the same snapshot as upstream's demo**, so they show on
  My week, Upcoming and Insights too. That is honest — a real account's
  customer tasks do — but it means upstream's journeys see them.

## Not yet built

The sidebar rows the fork adds carry no counts yet. The counts SPEC asks for —
customers with in-period tasks, open objectives today, live initiatives — need
the domain rules from Phase 3, so `ExtNav` renders the rows without them until
then. The markup is upstream's `navItem`, which already leaves a zero count
out, so the counts are a small change when the rules exist.
