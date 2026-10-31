import { expect, test } from '@playwright/test';

test('loads, shows body diagram, and runs a suggested workout end to end', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Your training, your equipment, your progress.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'How it works' })).toBeVisible();
  await expect(page.getByText(/Your workouts stay on this device/)).toBeVisible();
  await page.getByRole('link', { name: 'Recovery' }).click();
  await expect(page.getByRole('heading', { name: 'Muscle recovery' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Front muscle diagram' })).toBeVisible();
  await page.locator('[data-muscle="chest"]').first().click();
  await expect(page.getByLabel('Chest stats')).toBeVisible();

  await page.goto('./#/suggest');
  await page.getByRole('button', { name: 'Suggest workout' }).click();
  await expect(page.getByRole('heading', { name: 'Workout overview' })).toBeVisible();
  await page.getByRole('button', { name: 'Start workout' }).click();
  await page.getByRole('button', { name: 'Complete set' }).click();
  await expect(page.getByRole('timer', { name: 'Rest' })).toBeVisible();
  await page.getByRole('button', { name: 'Skip rest' }).click();
  await page.getByRole('button', { name: 'Finish workout' }).click();

  await page.goto('./#/history');
  await expect(page.getByLabel('Search history')).toBeVisible();
  await expect(page.getByRole('link').filter({ hasText: /workout/i }).first()).toBeVisible();
});

test('landing page actions lead to the relevant app flows', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('link', { name: 'Home' })).toBeVisible();
  await page.getByRole('link', { name: 'Start a workout' }).click();
  await expect(page.getByRole('heading', { name: 'Workouts', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Home' }).click();
  await expect(page.getByRole('heading', { name: 'Your training, your equipment, your progress.' })).toBeVisible();
  await page.goto('./');
  await page.getByRole('link', { name: 'Build a custom workout' }).click();
  await expect(page.getByRole('heading', { name: 'Build a workout' })).toBeVisible();
  await page.goto('./');
  await page.getByRole('link', { name: 'Set up your equipment' }).click();
  await expect(page.getByRole('heading', { name: 'My equipment' })).toBeVisible();
});

test('landing content uses row cards without changing other card layouts', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('.landing-feature').first()).toHaveCSS('flex-direction', 'row');
  await expect(page.locator('.landing-step').first()).toHaveCSS('flex-direction', 'row');

  await page.getByRole('link', { name: 'Recovery' }).click();
  await expect(page.locator('.home-grid > .card').first()).toHaveCSS('flex-direction', 'column');
});

test('equipment weight options constrain workout suggestions', async ({ page }) => {
  await page.goto('./#/equipment');
  await page.getByRole('checkbox', { name: /Dumbbells/ }).click();
  const dumbbellRow = page.locator('li').filter({ has: page.getByRole('checkbox', { name: /Dumbbells/ }) });
  await dumbbellRow.getByText('Available weights (optional)').click();
  await dumbbellRow.getByLabel('Dumbbells available weights').fill('5, 10, 15');
  await dumbbellRow.getByRole('button', { name: 'Save weights' }).click();
  await expect(dumbbellRow.getByText('Weights saved.')).toBeVisible();

  await page.getByRole('link', { name: 'Workouts' }).click();
  await page.getByRole('button', { name: 'Build custom workout' }).click();
  await page.getByRole('button', { name: 'Add exercise' }).click();
  await page.getByLabel('Search exercises').fill('Dumbbell Curl');
  await page.getByRole('button', { name: /Dumbbell Curl/ }).click();
  await page.getByRole('button', { name: 'Review workout' }).click();
  await expect(page.getByRole('heading', { name: 'Workout overview' })).toBeVisible();
  await expect(page.getByText('15 lb', { exact: true })).toBeVisible();
});

test('persists data in IndexedDB across reloads', async ({ page }) => {
  await page.goto('./#/equipment');
  await page.getByRole('checkbox', { name: /Dumbbells/ }).click();
  await expect(page.getByRole('checkbox', { name: /Dumbbells/ })).toBeChecked();
  await page.reload();
  await expect(page.getByRole('checkbox', { name: /Dumbbells/ })).toBeChecked();
});

test('layout has no horizontal overflow', async ({ page }) => {
  for (const hash of ['', '#/workouts', '#/history', '#/settings', '#/exercises']) {
    await page.goto('./' + hash);
    await page.waitForLoadState('networkidle');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  }
});

test('overview shows set-level rest beside cards, exercise guide, and active-workout brackets', async ({ page }) => {
  await page.goto('./#/suggest');
  const chips = page.getByRole('group', { name: 'Target muscles' }).locator('button');
  await expect(chips.first()).toHaveText('Full body');
  await expect(chips.first()).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: 'Supersets' }).click();
  await page.getByRole('button', { name: 'Suggest workout' }).click();
  await expect(page.getByRole('heading', { name: 'Workout overview' })).toBeVisible();

  const bracket = page.getByTestId('bracket').first();
  const rest = page.getByTestId('set-rest').nth(await page.getByTestId('set-rest').count() - 1);
  const [b, r] = [await bracket.boundingBox(), await page.getByTestId('bracket').first().locator('xpath=following-sibling::*[1]').boundingBox()];
  expect(r!.x).toBeGreaterThan(b!.x + b!.width - 1);
  await expect(rest).toBeVisible();
  await expect(page.getByTestId('exercise-rest').first()).toBeVisible();

  await page.getByRole('button', { name: /^Edit / }).first().click();
  const guide = page.getByTestId('exercise-guide');
  await expect(guide.getByRole('heading', { name: 'How to perform' })).toBeVisible();
  await expect(guide.getByRole('img', { name: /start position/ })).toBeVisible();
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Start workout' }).click();
  await expect(page.getByTestId('set-form')).toBeVisible();
  await expect(page.getByTestId('bracket').first()).toBeVisible();
});

test('sticky modal header, pause, and active-workout guide', async ({ page }) => {
  await page.goto('/#/suggest');
  await page.getByRole('button', { name: 'Suggest workout' }).click();
  await page.getByRole('button', { name: /^Edit / }).first().click();
  const modal = page.locator('.modal');
  await modal.evaluate((m) => (m.scrollTop = 400));
  const top = (await modal.boundingBox())!.y;
  const head = (await modal.locator('header').boundingBox())!.y;
  expect(Math.abs(head - top)).toBeLessThan(4);
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Start workout' }).click();
  await page.getByRole('button', { name: /^About / }).first().click();
  await expect(page.getByTestId('exercise-guide')).toBeVisible();
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Pause workout' }).click();
  await expect(page.getByRole('button', { name: 'Complete set' })).toBeDisabled();
  await page.getByRole('button', { name: /^About / }).first().click();
  await expect(page.getByTestId('exercise-guide')).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', { name: 'Resume workout' }).click();
  await expect(page.getByRole('button', { name: 'Complete set' })).toBeEnabled();
});

test('HIIT auto-advance setting persists', async ({ page }) => {
  await page.goto('/#/settings');
  const box = page.getByRole('checkbox', { name: /Auto-complete HIIT/ });
  await box.click();
  await expect(box).toBeChecked();
  await page.reload();
  await expect(page.getByRole('checkbox', { name: /Auto-complete HIIT/ })).toBeChecked();
});
