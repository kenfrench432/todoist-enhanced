import { expect, go, test } from './demo';

/**
 * Pointing a customer or a focus area at a different Todoist label.
 *
 * Note the `exact: true` on the Name fields: an accessible name is matched by
 * substring, so plain 'Name' also finds 'Short name'.
 *
 * It re-points; it renames nothing. These assert the consequence as well as
 * the control: the tasks that follow the label, and the momentum that counts
 * by it.
 */

test('a customer can be pointed at a different label, and its tasks follow', async ({ demo: page }) => {
  await go(page, '#/customers');
  await page.getByRole('button', { name: /^All/ }).first().click();
  const avon = page.locator('.ext-customer').filter({ hasText: 'Avon' }).first();
  await expect(avon).toContainText('Send the quarterly value review');

  // Point Avon at a label nothing of hers carries.
  await go(page, '#/manage');
  const row = page.locator('.ext-table tbody tr').filter({ hasText: 'Avon' }).first();
  await row.getByLabel('Todoist label').click();
  await page.getByRole('option', { name: '@automation' }).click();

  /* Nothing was renamed: her old tasks still carry @avon and so are no longer
     hers, and whatever carries @automation is. */
  await go(page, '#/customers');
  await page.getByRole('button', { name: /^All/ }).first().click();
  const after = page.locator('.ext-customer').filter({ hasText: 'Avon' }).first();
  await expect(after).not.toContainText('Send the quarterly value review');
});

test('the picker refuses a label another customer already means', async ({ demo: page }) => {
  await go(page, '#/manage');
  const avon = page.locator('.ext-table tbody tr').filter({ hasText: '@avon' }).first();
  await avon.getByLabel('Todoist label').click();

  // Aston Martin's label is not on offer; Avon's own still is.
  await expect(page.getByRole('option', { name: '@aston-martin' })).toHaveCount(0);
  await expect(page.getByRole('option', { name: '@avon' })).toHaveCount(1);
});

/* The shipped areas point at labels a fresh account has never had, which is
   what "Create it" is for. One label belongs to one area, so a label another
   area means is never on offer — that rule is unit-tested; this proves the
   creating half end to end. */
test('a focus label Todoist has not got can be created from here', async ({ demo: page }) => {
  await go(page, '#/manage/goals');
  const row = page.locator('.ext-focusrow').first();

  await expect(row.getByLabel(/^Label/)).toContainText('not in Todoist');
  await row.getByRole('button', { name: 'Create it' }).click();

  // Once it exists the picker stops flagging it, and stops offering to make it.
  await expect(row.getByLabel(/^Label/)).not.toContainText('not in Todoist');
  await expect(row.getByRole('button', { name: 'Create it' })).toHaveCount(0);

  // And it is a real Todoist label now, listed with the rest.
  await go(page, '#/labels');
  await expect(page.locator('.screen.active')).toContainText('focus-maturity-framework');
});

test('a focus area is renamed, recoloured and removed', async ({ demo: page }) => {
  await go(page, '#/manage/goals');
  const row = page.locator('.ext-focusrow').first();

  await row.getByLabel('Name', { exact: true }).fill('Maturity, renamed');
  await row.getByLabel('Name', { exact: true }).blur();
  await expect(row.getByLabel('Name', { exact: true })).toHaveValue('Maturity, renamed');

  const before = await row.locator('.ext-dot').getAttribute('style');
  await row.locator('.ext-dot').click();
  await expect(row.locator('.ext-dot')).not.toHaveAttribute('style', before ?? '');

  await expect(page.locator('.ext-focusrow')).toHaveCount(3);
  await row.getByRole('button', { name: 'Remove' }).click();
  await row.getByRole('button', { name: 'Confirm' }).click();
  await expect(page.locator('.ext-focusrow')).toHaveCount(2);
});

test('a new focus area carries its own focus- label', async ({ demo: page }) => {
  await go(page, '#/manage/goals');
  await page.getByLabel('New focus area').fill('Partner enablement');
  await page.locator('.ext-focusareas').getByRole('button', { name: 'Add' }).click();

  const added = page.locator('.ext-focusrow').last();
  await expect(added.getByLabel('Name', { exact: true })).toHaveValue('Partner enablement');
  // Todoist has no such label yet, so the picker says so and offers to make it.
  await expect(added.getByLabel(/^Label/)).toContainText('focus-partner-enablement');
  await expect(added.getByRole('button', { name: 'Create it' })).toBeVisible();
});

test('nothing is written to Todoist from the demo', async ({ demo: page }) => {
  const posts: string[] = [];
  page.on('request', (r) => { if (r.method() === 'POST') posts.push(r.url()); });

  await go(page, '#/manage/goals');
  await page.locator('.ext-focusrow').first().getByLabel('Name', { exact: true }).fill('Changed');
  await page.locator('.ext-focusrow').first().getByLabel('Name', { exact: true }).blur();
  await page.waitForTimeout(900);

  expect(posts.filter((url) => url.includes('todoist.com'))).toEqual([]);
});
