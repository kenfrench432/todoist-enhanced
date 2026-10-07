import type { Page } from '@playwright/test';
import { expect, go, test } from './demo';

/** The Initiatives page: grouping, the warnings, and changing a status. */

const card = (page: Page, name: string) =>
  page.locator('.ext-initcard').filter({ hasText: name }).first();

test('groups by focus area and by status', async ({ demo: page }) => {
  await go(page, '#/initiatives');

  await expect(page.locator('.ext-grouptitle')).toContainText([
    'Bynder Maturity Framework', 'Scaling Book of Business', 'Measuring Value of TSM',
  ]);

  await page.getByRole('button', { name: 'Status', exact: true }).click();
  // Active first, then what needs a decision, then what is parked.
  const titles = await page.locator('.ext-grouptitle').allInnerTexts();
  expect(titles[0]).toContain('Active');
  expect(titles.join(' ')).toContain('Blocked');
  expect(titles.join(' ')).toContain('Idea');
});

/* Each warning, on the initiative shaped to earn it. */
test('the warnings say what is actually wrong', async ({ demo: page }) => {
  await go(page, '#/initiatives');

  await expect(card(page, 'Success plan templates').locator('.ext-warning'))
    .toHaveText(['Waiting on CS Ops to sign off the data fields']);

  await expect(card(page, 'Tiered engagement motion').locator('.ext-warning'))
    .toHaveText(['No next action']);

  // Active, something open, nothing finished for over a fortnight.
  await expect(card(page, 'Adoption-lift measurement method').locator('.ext-warning'))
    .toHaveText([/^Quiet for \d+ days$/]);

  // An idea is not live, so it is asked for nothing.
  await expect(card(page, 'Partner enablement kit').locator('.ext-warning')).toHaveCount(0);
});

test('changing a status swaps the label rather than stacking one', async ({ demo: page }) => {
  await go(page, '#/manage/initiatives');

  const manageCard = page.locator('.ext-initiative')
    .filter({ has: page.getByLabel('Status').locator('text=Idea') }).first();
  await manageCard.getByLabel('Status').click();
  await page.getByRole('option', { name: 'Active' }).click();

  await go(page, '#/initiatives');
  const kit = card(page, 'Partner enablement kit');
  await expect(kit.locator('.ext-statuschip')).toHaveText('Active');

  // It is live now, and has nothing open — so it earns the warning.
  await expect(kit.locator('.ext-warning')).toHaveText(['No next action']);

  // One status label, not two: the sub-task field would carry both otherwise.
  await kit.getByRole('button', { name: /open$/ }).click();
  await kit.getByLabel(/Add a task to this initiative/).fill('A first action');
  await kit.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(kit.locator('.ext-subtasks')).toContainText('status-active');
  await expect(kit.locator('.ext-subtasks')).not.toContainText('status-idea');
  await expect(kit.locator('.ext-warning')).toHaveCount(0);
});

test('the focus chips narrow the page', async ({ demo: page }) => {
  await go(page, '#/initiatives');
  const all = await page.locator('.ext-initcard').count();

  await page.getByRole('button', { name: /Scaling Book of Business/ }).first().click();
  await expect(page.locator('.ext-initcard')).toHaveCount(2);
  expect(all).toBeGreaterThan(2);

  await page.getByRole('button', { name: /Scaling Book of Business/ }).first().click();
  await expect(page.locator('.ext-initcard')).toHaveCount(all);
});

test('nothing is written to Todoist from the demo', async ({ demo: page }) => {
  const posts: string[] = [];
  page.on('request', (r) => { if (r.method() === 'POST') posts.push(r.url()); });

  await go(page, '#/initiatives');
  const one = card(page, 'Assessment to roadmap pipeline');
  await one.getByRole('button', { name: /open$/ }).click();
  await one.getByLabel(/Add a task to this initiative/).fill('A task');
  await one.getByRole('button', { name: 'Add', exact: true }).click();
  await page.waitForTimeout(900);

  expect(posts.filter((url) => url.includes('todoist.com'))).toEqual([]);
  await expect(one.locator('.ext-subtasks')).toContainText('A task');
});

test('the page holds together at phone width, in dark', async ({ demo: page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.setViewportSize({ width: 390, height: 844 });
  await go(page, '#/initiatives');

  await expect(page.locator('.ext-initcard').first()).toBeVisible();
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
