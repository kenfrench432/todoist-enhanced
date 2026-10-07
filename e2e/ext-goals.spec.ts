import type { Page } from '@playwright/test';
import { expect, go, test } from './demo';

/** Goals & KPIs: pace against the year, and whether the work is moving. */

const goal = (page: Page, title: string) =>
  page.locator('.ext-goalcard').filter({ hasText: title }).first();
const momentum = (page: Page, name: string) =>
  page.locator('.ext-momentum').filter({ hasText: name }).first();

test('each KPI reads its pace against the year', async ({ demo: page }) => {
  await go(page, '#/goals');

  await expect(goal(page, 'Every P1 on a maturity roadmap').locator('.ext-pacechip'))
    .toHaveText('On track');
  await expect(goal(page, 'Partners run their own assessments').locator('.ext-pacechip'))
    .toHaveText('Reached');

  /* Days to first value runs 45 down to 20: the ratio carries "lower is
     better" with no special case, and the delta is negative because the
     number falling is the improvement. */
  const ttfv = goal(page, 'Cut time to first value');
  await expect(ttfv.locator('.ext-pacechip')).toHaveText('At risk');
  await expect(ttfv).toContainText('-7d vs last month');
});

/* The phase's own "done when": the pace moves on the edit. */
test('editing Now moves the pace chip at once', async ({ demo: page }) => {
  await go(page, '#/goals');
  const roadmaps = goal(page, 'Every P1 on a maturity roadmap');
  await expect(roadmaps.locator('.ext-pacechip')).toHaveText('On track');

  const now = roadmaps.getByLabel(/Now$/);
  await now.fill('12');
  await now.blur();
  await expect(roadmaps.locator('.ext-pacechip')).toHaveText('Reached');

  await now.fill('1');
  await now.blur();
  await expect(roadmaps.locator('.ext-pacechip')).toHaveText('Behind');
});

test('the momentum cards tell the three focus areas apart', async ({ demo: page }) => {
  await go(page, '#/goals');

  await expect(momentum(page, 'Maturity Framework').locator('.ext-momentchip'))
    .toHaveText('Rising');
  await expect(momentum(page, 'Scaling Book of Business').locator('.ext-momentchip'))
    .toHaveText('Slowing');
  await expect(momentum(page, 'Measuring Value of TSM').locator('.ext-momentchip'))
    .toHaveText('Steady');

  // Eight weeks, the current one marked.
  await expect(momentum(page, 'Maturity Framework').locator('.barslot')).toHaveCount(8);
  await expect(momentum(page, 'Maturity Framework').locator('.bar.current')).toHaveCount(1);

  /* An area with an initiative going nowhere says so rather than naming a
     next task it has not got. */
  await expect(momentum(page, 'Scaling Book of Business'))
    .toContainText('1 initiative without a next action');
  await expect(momentum(page, 'Maturity Framework')).toContainText('Next:');
});

test('a momentum card filters the goals below it', async ({ demo: page }) => {
  await go(page, '#/goals');
  const all = await page.locator('.ext-goalcard').count();

  await momentum(page, 'Measuring Value of TSM').click();
  await expect(page.locator('.ext-goalcard')).toHaveCount(1);
  await expect(page.locator('.ext-goalcard')).toContainText('Every QBR opens with a number');

  await momentum(page, 'Measuring Value of TSM').click();
  await expect(page.locator('.ext-goalcard')).toHaveCount(all);
});

/* The link Initiatives' "Supports goal" points at. */
test('#/goals/<focus> opens with that area chosen', async ({ demo: page }) => {
  await go(page, '#/goals/sc');
  await expect(momentum(page, 'Scaling Book of Business'))
    .toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.ext-goalcard')).toContainText('Cut time to first value');
});

test('nothing is written to Todoist from the demo', async ({ demo: page }) => {
  const posts: string[] = [];
  page.on('request', (r) => { if (r.method() === 'POST') posts.push(r.url()); });

  await go(page, '#/goals');
  const now = goal(page, 'Every P1 on a maturity roadmap').getByLabel(/Now$/);
  await now.fill('11');
  await now.blur();
  await page.waitForTimeout(900);

  expect(posts.filter((url) => url.includes('todoist.com'))).toEqual([]);
  await expect(now).toHaveValue('11');
});

test('the page holds together at phone width, in dark', async ({ demo: page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.setViewportSize({ width: 390, height: 844 });
  await go(page, '#/goals');

  await expect(page.locator('.ext-momentum').first()).toBeVisible();
  await expect(page.locator('.ext-goalcard').first()).toBeVisible();
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
