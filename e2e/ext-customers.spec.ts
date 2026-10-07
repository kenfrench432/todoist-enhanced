import type { Page } from '@playwright/test';
import { expect, go, test } from './demo';

/**
 * The Customers page, on the fork's sample data.
 *
 * The counts are left to the rules rather than written down here: the demo's
 * dates are derived from the day it runs, so a task due in four days falls in
 * this week on a Monday and the next one on a Friday. What is asserted is what
 * the rules promise whatever the weekday.
 */

const card = (page: Page, name: string) =>
  page.locator('.ext-customer').filter({ hasText: name }).first();
const period = (page: Page, name: string) =>
  page.getByRole('button', { name: new RegExp(`^${name}`) }).first();

test('the period narrows what is shown, and the counts agree', async ({ demo: page }) => {
  await go(page, '#/customers');

  const count = async (name: string) =>
    Number((await period(page, name).innerText()).replace(/\D+/g, ''));
  const [today, week, all] = [await count('Today'), await count('This week'), await count('All')];
  expect(today).toBeLessThanOrEqual(week);
  expect(week).toBeLessThanOrEqual(all);
  expect(all).toBeGreaterThan(0);

  // Today takes what is due today and what is overdue, and nothing later.
  await period(page, 'Today').click();
  await expect(card(page, 'Avon')).toContainText('Send the quarterly value review');
  await expect(card(page, 'Avon')).toContainText('Chase the open support ticket');
  await expect(page.locator('.ext-customers')).not.toContainText('Book the kick-off workshop');

  await period(page, 'All').click();
  await expect(page.locator('.ext-customers')).toContainText('Book the kick-off workshop');
});

/* An engagement earns its place on Today by being close — within soonDays. */
test('Today shows the engagement that is close and hides the one that is not', async ({ demo: page }) => {
  await go(page, '#/customers');

  await period(page, 'All').click();
  await expect(page.locator('.ext-engagement')).toContainText(['Brand portal consolidation', 'Q4 platform rollout']);

  await period(page, 'Today').click();
  await expect(page.locator('.ext-customers')).toContainText('Q4 platform rollout');
  await expect(page.locator('.ext-customers')).not.toContainText('Brand portal consolidation');
});

test('an engagement is created with both labels, and takes sub-tasks', async ({ demo: page }) => {
  await go(page, '#/customers');
  await period(page, 'All').click();

  await card(page, 'Tailspin Travel').getByRole('button', { name: 'Add to Tailspin Travel' }).click();
  const composer = card(page, 'Tailspin Travel').locator('.ext-composer');
  await composer.getByRole('button', { name: 'Engagement', exact: true }).click();

  // The labels are on screen before anything is created.
  await expect(composer.locator('.ext-labelchip'))
    .toHaveText(['@tailspin-travel', '@engagement']);

  await composer.getByLabel('What is the engagement?').fill('Loyalty platform review');
  await composer.getByRole('button', { name: 'Add', exact: true }).click();

  const engagement = card(page, 'Tailspin Travel').locator('.ext-engagement');
  await expect(engagement).toContainText('Loyalty platform review');
  await expect(engagement).toContainText('0 of 0 done');

  await engagement.getByRole('button', { name: 'Add task' }).click();
  await engagement.locator('.ext-composer').getByLabel('What needs doing?').fill('Agree the scope');
  await engagement.locator('.ext-composer').getByRole('button', { name: 'Add', exact: true }).click();
  await expect(engagement).toContainText('0 of 1 done');
});

test('the filters narrow by CSM and tier together', async ({ demo: page }) => {
  await go(page, '#/customers');
  await period(page, 'All').click();
  const shown = await page.locator('.ext-customer').count();

  await page.getByRole('button', { name: /^Filters/ }).click();
  await page.getByRole('menuitemcheckbox', { name: 'Alex Moreau' }).click();
  await page.keyboard.press('Escape');
  const byCsm = await page.locator('.ext-customer').count();
  expect(byCsm).toBeLessThan(shown);

  // Across groups the filters narrow each other.
  await page.getByRole('button', { name: /^Filters/ }).click();
  await page.getByRole('menuitemcheckbox', { name: 'P3' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByText('No customers match these filters')).toBeVisible();

  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page.locator('.ext-customer')).toHaveCount(shown);
});

test('nothing is written to Todoist from the demo', async ({ demo: page }) => {
  const posts: string[] = [];
  page.on('request', (r) => { if (r.method() === 'POST') posts.push(r.url()); });

  await go(page, '#/customers');
  await period(page, 'All').click();
  await card(page, 'Avon').getByRole('button', { name: 'Add to Avon' }).click();
  await card(page, 'Avon').locator('.ext-composer').getByLabel('What needs doing?').fill('A task');
  await card(page, 'Avon').locator('.ext-composer')
    .getByRole('button', { name: 'Add', exact: true }).click();
  await page.waitForTimeout(900);

  expect(posts.filter((url) => url.includes('todoist.com'))).toEqual([]);
  await expect(card(page, 'Avon')).toContainText('A task');
});

test('the page holds together at phone width, in dark', async ({ demo: page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.setViewportSize({ width: 390, height: 844 });
  await go(page, '#/customers');

  await expect(page.locator('.ext-customer').first()).toBeVisible();
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
