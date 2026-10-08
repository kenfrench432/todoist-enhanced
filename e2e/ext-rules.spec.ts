import { expect, go, test } from './demo';

/**
 * Tidy up: rules, and pressing the button yourself.
 *
 * The thing worth proving is the negative. A rule that found four things to
 * fix changes nothing until Apply is pressed, and a change waved off is not
 * made — because the whole reason this is a review panel rather than an
 * automation is that a task parked somewhere on purpose has to stay there.
 *
 * The demo ships Ken's own two rules: label what lands in a customer project,
 * and move an engagement out of the Inbox.
 */

const CUSTOMER_PROJECT = 'Vermilion Books';

/* A customer task sitting in the Inbox, which the second demo rule moves. */
const ENGAGEMENT = 'Q4 platform rollout';

test('the rules say what they would change, and nothing more until Apply', async ({ demo: page }) => {
  await go(page, '#/manage/rules');

  // Two rules, read as sentences, and what they add up to.
  await expect(page.locator('.ext-rulerow')).toHaveCount(2);
  const pending = page.locator('.ext-pendingrow');
  await expect(pending).toHaveCount(4);
  await expect(page.getByRole('button', { name: 'Apply 4 changes' })).toBeEnabled();

  // The engagement is still in the Inbox: listing a change is not making it.
  await go(page, '#/project/inbox');
  await expect(page.locator('.screen.active')).toContainText(ENGAGEMENT);

  await go(page, '#/manage/rules');
  await page.getByRole('button', { name: 'Apply 4 changes' }).click();

  // Now it has moved, and the list has nothing left to say.
  await expect(page.locator('.ext-pendingrow')).toHaveCount(0);
  await expect(page.locator('.ext-tab')).toContainText('Nothing to tidy');

  await page.locator('.sidebar').getByRole('button', { name: CUSTOMER_PROJECT }).first().click();
  await expect(page.locator('.screen.active')).toContainText(ENGAGEMENT);
});

/* The reason this is a panel and not an automation: the one you leave out
   stays as it was, and stays on the list. */
test('a change waved off is not made', async ({ demo: page }) => {
  await go(page, '#/manage/rules');

  const held = page.locator('.ext-pendingrow').filter({ hasText: ENGAGEMENT });
  await held.locator('input[type="checkbox"]').uncheck();
  await expect(page.getByRole('button', { name: 'Apply 3 changes' })).toBeVisible();

  await page.getByRole('button', { name: 'Apply 3 changes' }).click();

  await expect(page.locator('.ext-pendingrow')).toHaveCount(1);
  await expect(page.locator('.ext-pendingrow')).toContainText(ENGAGEMENT);

  await go(page, '#/project/inbox');
  await expect(page.locator('.screen.active')).toContainText(ENGAGEMENT);
});

test('switching a rule off empties what it was claiming', async ({ demo: page }) => {
  await go(page, '#/manage/rules');
  await expect(page.locator('.ext-pendingrow')).toHaveCount(4);

  // The first rule is the labelling one; off, its two go.
  await page.locator('.ext-rulerow').first().getByRole('switch').click();
  await expect(page.locator('.ext-pendingrow')).toHaveCount(2);

  await page.locator('.ext-rulerow').nth(1).getByRole('switch').click();
  await expect(page.locator('.ext-tab')).toContainText('Nothing to tidy');
});

/* A rule with no condition would claim every task in the account, so a new
   one starts empty, says what it is missing, and claims nothing. */
test('a new rule claims nothing until it is told what to match', async ({ demo: page }) => {
  await go(page, '#/manage/rules');

  await page.getByRole('button', { name: 'New rule' }).click();
  const fresh = page.locator('.ext-rulerow').last();
  await expect(fresh).toContainText('Needs something to match on');
  await expect(page.locator('.ext-pendingrow')).toHaveCount(4);

  // Given both halves, it stops complaining — and here matches what rule two already fixes.
  await fresh.getByLabel('When a task is in').click();
  await page.getByRole('option', { name: 'Inbox' }).click();
  await fresh.getByLabel('add the label').click();
  await page.getByRole('option', { name: '@engagement' }).click();
  await expect(fresh).not.toContainText('Needs something to match on');

  await expect(page.locator('.ext-rulerow')).toHaveCount(3);
  await fresh.getByRole('button', { name: 'Remove' }).click();
  await fresh.getByRole('button', { name: 'Confirm' }).click();
  await expect(page.locator('.ext-rulerow')).toHaveCount(2);
});

test('the tab count is the size of the mess, not the number of rules', async ({ demo: page }) => {
  await go(page, '#/manage');
  const tab = page.getByRole('tab', { name: 'Tidy up' });
  await expect(tab).toContainText('4');

  await tab.click();
  await page.getByRole('button', { name: 'Apply 4 changes' }).click();
  await expect(tab).toContainText('0');
});

test('nothing is written to Todoist from the demo', async ({ demo: page }) => {
  const posts: string[] = [];
  page.on('request', (r) => { if (r.method() === 'POST') posts.push(r.url()); });

  await go(page, '#/manage/rules');
  await page.getByRole('button', { name: 'Apply 4 changes' }).click();
  await expect(page.locator('.ext-pendingrow')).toHaveCount(0);
  await page.waitForTimeout(900);

  expect(posts.filter((url) => url.includes('todoist.com'))).toEqual([]);
});
