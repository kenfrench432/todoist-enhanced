import type { Page } from '@playwright/test';
import { expect, go, test } from './demo';

/** Objectives: the four cadences, what supports what, and moving one on. */

const tab = (page: Page, name: string) =>
  page.locator('.ext-objectives .tabs').getByRole('tab', { name: new RegExp(`^${name}`) });
const title = (page: Page) => page.locator('.ext-periodtext strong');
const forward = (page: Page) => page.getByRole('button', { name: 'Next period' });
const row = (page: Page, name: string) =>
  page.locator('.ext-objrow').filter({ hasText: name }).first();

test('the cadences each hold their own period', async ({ demo: page }) => {
  await go(page, '#/objectives');

  await tab(page, 'Day').click();
  await expect(title(page)).toHaveText('Today');
  await expect(row(page, 'Send the rubric to Product')).toBeVisible();

  await tab(page, 'Week').click();
  await expect(title(page)).toHaveText('This week');
  await expect(row(page, 'Agree the scoring rubric with Product')).toBeVisible();

  await tab(page, 'Quarter').click();
  await expect(title(page)).toHaveText(/^Q\d \d{4}$/);
  await expect(row(page, 'Every P1 has a roadmap they agreed to')).toBeVisible();
});

/* A completed objective still belongs to its period: the capacity row counts
   it as done rather than losing it from the total. */
test('a completed objective counts as done, not as gone', async ({ demo: page }) => {
  await go(page, '#/objectives');
  await tab(page, 'Week').click();

  await expect(page.locator('.ext-capacity')).toContainText('1 done');
  await expect(row(page, 'Clear the Avon support backlog')).toHaveClass(/done/);

  // Ticking another off moves it across rather than removing it.
  await row(page, 'Draft the tiered motion one-pager').getByRole('checkbox').click();
  await expect(page.locator('.ext-capacity')).toContainText('2 done');
  await expect(row(page, 'Draft the tiered motion one-pager')).toHaveClass(/done/);
});

test('an objective says what it supports, and opens it', async ({ demo: page }) => {
  await go(page, '#/objectives');
  await tab(page, 'Week').click();

  const weekly = row(page, 'Agree the scoring rubric with Product');
  await expect(weekly.locator('.ext-parentchip')).toContainText('Three roadmaps agreed this month');

  await weekly.locator('.ext-parentchip').click();
  await expect(title(page)).toHaveText(/^\w+ \d{4}$/);          // a month
  await expect(row(page, 'Three roadmaps agreed this month')).toBeVisible();
  // And that one says what it supports in turn.
  await expect(row(page, 'Three roadmaps agreed this month').locator('.ext-parentchip'))
    .toContainText('Every P1 has a roadmap they agreed to');
});

test('a new weekly objective is added, then moved to next week', async ({ demo: page }) => {
  await go(page, '#/objectives');
  await tab(page, 'Week').click();

  await page.getByRole('button', { name: 'New objective' }).click();
  const form = page.locator('.ext-newobjective');
  await form.getByLabel('New objective').fill('Write the partner enablement brief');
  await form.getByLabel('Supports').click();
  await page.getByRole('option', { name: 'Three roadmaps agreed this month' }).click();
  await form.getByRole('button', { name: 'Add objective' }).click();

  const added = row(page, 'Write the partner enablement brief');
  await expect(added).toBeVisible();
  await expect(added.locator('.ext-parentchip')).toContainText('Three roadmaps agreed this month');

  await added.getByRole('button', { name: /^Move to/ }).click();
  await expect(row(page, 'Write the partner enablement brief')).toHaveCount(0);

  await forward(page).click();
  await expect(row(page, 'Write the partner enablement brief')).toBeVisible();
});

test('the notes belong to their period', async ({ demo: page }) => {
  await go(page, '#/objectives');
  await tab(page, 'Week').click();
  await page.getByLabel('Notes').fill('The rubric unblocks the partner workshops.');

  await forward(page).click();
  await expect(page.getByLabel('Notes')).toHaveValue('');

  await page.getByRole('button', { name: 'Back to today' }).click();
  await expect(page.getByLabel('Notes')).toHaveValue('The rubric unblocks the partner workshops.');
});

test('nothing is written to Todoist from the demo', async ({ demo: page }) => {
  const posts: string[] = [];
  page.on('request', (r) => { if (r.method() === 'POST') posts.push(r.url()); });

  await go(page, '#/objectives');
  await row(page, 'Send the rubric to Product').getByRole('checkbox').click();
  await page.getByLabel('Notes').fill('A note.');
  await page.waitForTimeout(900);

  expect(posts.filter((url) => url.includes('todoist.com'))).toEqual([]);
  await expect(row(page, 'Send the rubric to Product')).toHaveClass(/done/);
});

test('the page holds together at phone width, in dark', async ({ demo: page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.setViewportSize({ width: 390, height: 844 });
  await go(page, '#/objectives');

  await expect(page.locator('.ext-objrow').first()).toBeVisible();
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
