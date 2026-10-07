import type { Page } from '@playwright/test';
import { expect, go, test, titles } from './demo';

/**
 * Projects kept out of this app.
 *
 * The point of these is that the effect lands on **upstream's** pages, not
 * only the fork's — so they assert against My week and Upcoming.
 */

const hide = async (page: Page, name: string) => {
  await go(page, '#/manage');
  await page.locator('.ext-hidden').getByRole('button', { name, exact: true }).click();
};

/**
 * A task on My week that names its project, picked from the page rather than
 * hard-coded — the demo's dates move with the day it runs.
 *
 * Read in one evaluate: a round trip per row times the whole spec out.
 */
async function somethingInMyWeek(page: Page): Promise<{ project: string; task: string }> {
  await go(page, '#/week');
  const found = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('.screen.active [data-task-id]'));
    for (const row of rows) {
      const project = row.querySelector('.proj')?.textContent?.trim() ?? '';
      const task = row.querySelector('.ttitle')?.textContent?.trim() ?? '';
      if (project && task) return { project: project.replace(/^#/, ''), task };
    }
    return null;
  });
  if (!found) throw new Error('no project-labelled task on My week to hide');
  return found;
}

test('hiding a project takes its tasks out of upstream’s pages', async ({ demo: page }) => {
  const { project, task } = await somethingInMyWeek(page);

  await go(page, '#/week');
  expect(await titles(page)).toContain(task);

  await hide(page, project);

  // The whole point: it lands on upstream's own views, not just the fork's.
  await go(page, '#/week');
  expect(await titles(page)).not.toContain(task);
  await go(page, '#/upcoming');
  expect(await titles(page)).not.toContain(task);
});

/* Otherwise the sidebar row opens an empty page, which is worse than simply
   not listing the tasks elsewhere. */
test('the hidden project’s own page still shows its tasks', async ({ demo: page }) => {
  const { project, task } = await somethingInMyWeek(page);
  await hide(page, project);

  await go(page, '#/week');
  expect(await titles(page)).not.toContain(task);

  await page.locator('.sidebar').getByRole('button', { name: project }).first().click();
  await expect(page.locator('.screen.active')).toContainText(task);
});

test('un-hiding brings it back', async ({ demo: page }) => {
  const { project, task } = await somethingInMyWeek(page);

  await hide(page, project);
  await go(page, '#/week');
  expect(await titles(page)).not.toContain(task);

  await hide(page, project);   // the chip toggles
  await go(page, '#/week');
  expect(await titles(page)).toContain(task);
});

test('the chip says which projects are hidden', async ({ demo: page }) => {
  const { project } = await somethingInMyWeek(page);
  await go(page, '#/manage');

  const chip = page.locator('.ext-hidden').getByRole('button', { name: project, exact: true });
  await expect(chip).toHaveAttribute('aria-pressed', 'false');
  await chip.click();
  await expect(chip).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.ext-hidden .ext-count')).toHaveText('1');
});

test('nothing is written to Todoist from the demo', async ({ demo: page }) => {
  const posts: string[] = [];
  page.on('request', (r) => { if (r.method() === 'POST') posts.push(r.url()); });

  const { project } = await somethingInMyWeek(page);
  await hide(page, project);
  await page.waitForTimeout(900);

  expect(posts.filter((url) => url.includes('todoist.com'))).toEqual([]);
});
