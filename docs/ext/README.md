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

The sidebar rows carry no counts. SPEC asks for three — customers with
in-period tasks, open objectives today, live initiatives — and the rules that
work them out all exist now (`customerTasks`, `objectivesInPeriod`,
`initiativesIn`). What is missing is only the wiring: `ExtNav` would have to
read `useExt` and the snapshot, which it deliberately does not, because it
renders inside upstream's `Sidebar` on every page in the app. The markup is
upstream's `navItem` and already leaves a zero count out, so this is a small
change whenever it is wanted.

## Releasing

The production copy is **https://todoist-ui.pages.dev/**, built by Cloudflare
Pages from `main`.

Two environment variables on the Pages project:

```
NODE_VERSION = 22
PUBLIC_URL   = https://todoist-ui.pages.dev/
```

`NODE_VERSION` is belt-and-braces — `.nvmrc` pins 22 and Pages reads it.
**`PUBLIC_URL` is not optional**, and getting it wrong looks like a bug in the
app rather than a misconfiguration: the build writes `oauth/client.json` from
it, Todoist fetches that file to identify the app, and if the variable is
missing the build *silently* falls back to upstream's official URL. Sign-in
then fails with `invalid_client` and nothing on screen explains why. The
trailing slash matters, and the value must be the host you actually sign in
on — not the `pages.dev` address underneath a custom domain.

After a deploy, four checks:

```bash
curl -o /dev/null -w '%{http_code}\n'    https://todoist-ui.pages.dev/icon-192.png
curl -o /dev/null -w '%{content_type}\n' https://todoist-ui.pages.dev/manifest.webmanifest
curl -s https://todoist-ui.pages.dev/oauth/client.json | head -c 60
curl -sI https://todoist-ui.pages.dev/ | grep -i content-security-policy
```

Expected: `200`; `application/manifest+json`; a `client_id` **equal to the host
above**; and a CSP line. The manifest type and the CSP come from
`public/_headers`, which is this fork's replacement for upstream's `.htaccess`
— Cloudflare Pages does not read `.htaccess`. Keep the CSP in step with
`preview.headers` in `vite.config.ts`; if a view ever fetches from another
host, add it to `connect-src` in both.

Upstream merges arrive through the **Sync upstream** workflow: every Monday,
or on demand from the Actions tab. It opens a pull request, Pages builds a
preview for it, and you review and merge. `UPDATING.md` has the detail.

### The login in front of it

The site sits behind **Cloudflare Access** (Zero Trust → Access →
Applications), so the URL is not publicly browsable. Nothing in this repo
implements it; it is three applications on the dashboard, and the second one
is not optional.

| Application | Path | Policy |
| --- | --- | --- |
| The app | `todoist-ui.pages.dev/*` | **Allow** → Emails → your address. One-time PIN by email needs no identity provider. |
| OAuth metadata | `todoist-ui.pages.dev/oauth/*` | **Bypass** → Everyone |
| The logo | `todoist-ui.pages.dev/icon-192.png` | **Bypass** → Everyone |

**Why the second one exists.** `client_id` is not a secret string, it is a
URL: `https://todoist-ui.pages.dev/oauth/client.json`. **Todoist's servers
fetch that file** to find out what the app is. They have no Access session and
never will, so gating it makes "Continue with Todoist" fail with
`invalid_client` — the same symptom as a missing `PUBLIC_URL`, from a
completely different cause.

**Why the third.** `logo_uri` points at `/icon-192.png`, which Todoist's
consent screen loads cross-site. An Access cookie is not sent on that kind of
request, so without the bypass the authorise page shows a broken logo. Only
cosmetic — leave it gated if you would rather.

Access matches the more specific path, so the two bypasses win over the `/*`
rule. Do not take that on trust: after setting it up, prove it.

```bash
# Must stay public — Todoist is the one fetching these.
curl -s -o /dev/null -w 'client.json  %{http_code}\n' https://todoist-ui.pages.dev/oauth/client.json
curl -s -o /dev/null -w 'icon-192     %{http_code}\n' https://todoist-ui.pages.dev/icon-192.png

# Must now be gated — a browser with no Access session.
curl -s -o /dev/null -w 'app root     %{http_code} -> %{redirect_url}\n' https://todoist-ui.pages.dev/
```

The first two should still read `200`. The third should read `302` to a
`cloudflareaccess.com` login. If the root still reads `200`, the policy is not
on; if `client.json` reads `302`, sign-in is broken and the bypass is missing
or ordered wrong.

Two things to expect once it is on: the Access session expires (24 hours by
default — raise it in the application's settings if signing in daily is
annoying), and the installed PWA goes through the same login, so an expired
session shows the Cloudflare page inside the app window.

## What this fork adds

Five pages, for running a technical success manager's week:

| Page | What it answers |
| --- | --- |
| **Customers** (`#/customers`) | What is on for each customer today, this week, or at all — their loose tasks and their engagements, with a composer that applies the right labels without anyone typing an `@`. |
| **Initiatives** (`#/initiatives`) | Which internal projects are moving and which are stuck — grouped by focus area or status, with warnings for blocked, no next action, and gone quiet. |
| **Goals & KPIs** (`#/goals`) | Two different questions side by side: are the numbers moving (KPI pace against the share of the year gone), and is anyone doing anything about it (completed actions per focus area over 8 weeks). |
| **Objectives** (`#/objectives`) | A few outcomes per day, week, month and quarter, each supporting the level above it. |
| **Manage** (`#/manage`) | Where the lists the other four read from are set up: customers, CSMs, stages, goals and KPIs, initiatives. |

**Everything Todoist can hold, Todoist holds.** A customer is a label; an
engagement, an initiative and an objective are tasks carrying marker labels; a
target is a `deadline`. Nothing is duplicated into a database. What Todoist has
no field for — a customer's CSM, stage and tier, goals and KPIs, the links
between objectives, a period's notes — is one JSON document in its own Inbox
comment, the same mechanism upstream already uses for its settings.

**The fork is 56 files under `src/ext/`, and five lines of upstream.**

That was the single rule the whole build was shaped around, and it held for all
ten phases: `git diff upstream/main -- src ':!src/ext'` reads **5 files
changed, 25 insertions, 1 deletion** — the `ViewId` union, the router's known
list, two lines in `App.tsx`, one in `Sidebar.tsx`, and the stylesheet import.
Every weekly upstream merge has those five lines to reconcile and nothing else.

It is covered by **655 unit tests** across 13 files and **33 end-to-end
journeys** in five `e2e/ext-*.spec.ts` files. The rules are pure functions in
`src/ext/domain/` that take "now" as an argument rather than reading the clock,
which is why they can be tested on a date chosen to break them (Tue 29 Sep
2026: week 40 straddles a month end and Q3 ends the next day).
