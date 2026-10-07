import { expect, go, test } from './demo';

/**
 * Manage: the lists the other four pages read from.
 *
 * A note on the locators: nearly everything editable here is an `<input>`, and
 * an input's value is not text content — so `filter({ hasText })` cannot find
 * a customer or a goal by its name. These pick rows out by structure instead:
 * the label chip, which is real text, or the group a goal sits in.
 */

test('the tabs are in the address and carry their counts', async ({ demo: page }) => {
  await go(page, '#/manage');
  const tabs = page.locator('.ext-manage .tabs');
  await expect(tabs.getByRole('tab', { name: /^Customers/ })).toContainText('6');
  await expect(tabs.getByRole('tab', { name: /^Goals/ })).toContainText('4');

  await tabs.getByRole('tab', { name: /^Initiatives/ }).click();
  expect(await page.evaluate(() => window.location.hash)).toBe('#/manage/initiatives');
  await page.reload();
  await expect(tabs.getByRole('tab', { name: /^Initiatives/ }))
    .toHaveAttribute('aria-selected', 'true');
});

/* The label is on every one of that customer's tasks: renaming here must
   never touch it. */
test('renaming a customer leaves its Todoist label alone', async ({ demo: page }) => {
  await go(page, '#/manage');
  const avon = page.locator('.ext-table tbody tr').filter({ hasText: '@avon' }).first();

  await avon.getByLabel('Customer').fill('Avon Cosmetics');
  await avon.getByLabel('Customer').blur();
  await expect(avon.getByLabel('Customer')).toHaveValue('Avon Cosmetics');
  await expect(avon.locator('.ext-labelchip')).toHaveText('@avon');

  // And the renamed customer still owns its tasks, which the label decides.
  await go(page, '#/customers');
  await page.getByRole('button', { name: /^All/ }).first().click();
  await expect(page.locator('.ext-customer').filter({ hasText: 'Avon Cosmetics' }).first())
    .toContainText('Send the quarterly value review');
});

test('removing a CSM leaves its customers unassigned', async ({ demo: page }) => {
  await go(page, '#/manage');
  await page.getByRole('button', { name: /^CSMs/ }).click();
  const csms = page.locator('.ext-twocards .card').first();

  // Third in the list, in the order the sample data sets them out.
  const row = csms.locator('.ext-namerow').nth(2);
  await expect(row.getByLabel('Name')).toHaveValue('Jo Lindqvist');
  await row.getByRole('button', { name: 'Remove' }).click();
  await row.getByRole('button', { name: 'Confirm' }).click();

  // Two left. The add field carries its own label, so it is not one of these.
  await expect(csms.locator('input[aria-label="Name"]')).toHaveCount(2);
  const northwind = page.locator('.ext-table tbody tr').filter({ hasText: '@northwind-foods' }).first();
  await expect(northwind.getByLabel('CSM')).toContainText('Unassigned');
});

/* Removing a goal takes its KPIs and unlinks what supported it. */
test('removing a goal takes its KPIs with it', async ({ demo: page }) => {
  await go(page, '#/manage/goals');
  /* The only goal under this focus area, which is a heading rather than an
     input and so can actually be matched on. */
  const group = page.locator('.ext-group').filter({ hasText: 'Scaling Book of Business' });
  const goal = group.locator('.ext-goal').first();
  await expect(goal.getByLabel('What is the goal?')).toHaveValue('Cut time to first value');
  await expect(goal.locator('.ext-kpitable tbody tr')).toHaveCount(1);
  await expect(goal).toContainText('initiative');

  await goal.getByRole('button', { name: 'Remove', exact: true }).click();
  await goal.getByRole('button', { name: 'Confirm' }).click();

  await expect(group.locator('.ext-goal')).toHaveCount(0);
  // Its KPI went with it: no field on the page still holds that name.
  await expect(page.locator('input[value="Days to first value"]')).toHaveCount(0);
  await expect(page.locator('.ext-kpitable')).toHaveCount(3);   // one per goal left

  // The initiative that supported it is untouched, and simply supports nothing.
  await go(page, '#/initiatives');
  await expect(page.locator('.ext-initcard').filter({ hasText: 'Success plan templates' }))
    .toHaveCount(1);
});

test('an unregistered label can be registered in one click', async ({ demo: page }) => {
  await go(page, '#/manage');
  const unlinked = page.locator('.ext-unlinked');
  await expect(unlinked).toContainText('@automation');

  await unlinked.getByRole('button', { name: 'Register' }).first().click();
  await expect(page.locator('.ext-table tbody tr').filter({ hasText: '@automation' }))
    .toHaveCount(1);
});

test('nothing is written to Todoist from the demo', async ({ demo: page }) => {
  const posts: string[] = [];
  page.on('request', (r) => { if (r.method() === 'POST') posts.push(r.url()); });

  await go(page, '#/manage');
  await page.getByLabel('Add customer').fill('Fabrikam Energy');
  await page.locator('.ext-addcustomer').getByRole('button', { name: 'Add' }).click();
  await page.waitForTimeout(900);

  expect(posts.filter((url) => url.includes('todoist.com'))).toEqual([]);
  await expect(page.locator('.ext-table tbody tr').filter({ hasText: '@fabrikam-energy' }))
    .toHaveCount(1);
});

test('the tables become cards at phone width, in dark', async ({ demo: page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.setViewportSize({ width: 390, height: 844 });
  await go(page, '#/manage');

  await expect(page.locator('.ext-table thead')).toBeHidden();
  await expect(page.locator('.ext-table tbody tr').first()).toBeVisible();
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
