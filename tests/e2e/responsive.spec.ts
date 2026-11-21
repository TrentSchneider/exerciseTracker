import { expect, test, type Locator, type Page } from '@playwright/test';

async function expectTextOnOneLine(locator: Locator) {
  const lines = await locator.evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    return range.getClientRects().length;
  });
  expect(lines).toBe(1);
}

async function expectLayoutFits(page: Page) {
  const problems = await page.evaluate(() => {
    const root = document.documentElement;
    const issues: string[] = [];
    if (root.scrollWidth > root.clientWidth + 1) {
      issues.push(`Page width ${root.scrollWidth} exceeds viewport ${root.clientWidth}`);
    }
    for (const element of document.querySelectorAll<HTMLElement>('.content .card, .content fieldset, .content .row-between, .active-controls, .modal, .modal header, .list-btn')) {
      if (element.clientWidth && element.scrollWidth > element.clientWidth + 1) {
        issues.push(`${element.tagName}.${element.className}: ${element.scrollWidth} > ${element.clientWidth}`);
      }
    }
    return issues;
  });
  expect(problems).toEqual([]);
}

for (const width of [320, 375, 480]) {
  test.describe(`responsive at ${width}px`, () => {
    test.use({ viewport: { width, height: 640 } });

    test('main pages, planner and dialogs fit', async ({ page }) => {
      for (const route of ['', 'recovery', 'workouts', 'suggest', 'build', 'plan', 'history', 'exercises', 'exercises/db_curl', 'equipment', 'settings']) {
        await page.goto(`./#/${route}`);
        await expect(page.locator('main h1')).toBeVisible();
        await expectLayoutFits(page);
      }

      await page.goto('./#/plan');
      await expectTextOnOneLine(page.getByRole('heading', { name: 'Planner' }));
      await expectTextOnOneLine(page.getByRole('button', { name: 'Calendar' }));
      await expectTextOnOneLine(page.getByText('Date', { exact: true }));
      await page.getByRole('button', { name: 'Calendar' }).click();
      await expect(page.getByTestId('calendar')).toBeVisible();
      await expectLayoutFits(page);
      await page.getByRole('button', { name: /New routine/ }).click();
      await page.getByRole('button', { name: 'Add training day' }).click();
      await expectLayoutFits(page);
      await page.keyboard.press('Escape');

      await page.goto('./#/exercises');
      await page.getByRole('button', { name: 'Add custom exercise' }).click();
      await expectLayoutFits(page);
    });

    test('long names fit in workout preview, active workout, rest and exercise guide', async ({ page }) => {
      const name = 'ExtraordinarilyLongUnbrokenExerciseNameForNarrowScreenTesting';
      const workout = 'A very long workout name for a small screen';
      await page.goto('./#/exercises');
      await page.getByRole('button', { name: 'Add custom exercise' }).click();
      await page.getByLabel('Name', { exact: true }).fill(name);
      await page.getByRole('group', { name: 'Primary muscles' }).getByRole('button', { name: 'Chest' }).click();
      await page.getByRole('button', { name: 'Save exercise' }).click();
      await expect(page.getByRole('link', { name: new RegExp(name) })).toBeVisible();
      await expectLayoutFits(page);

      await page.goto('./#/build');
      await page.getByLabel('Workout name').fill(workout);
      await page.getByRole('button', { name: 'Add exercise' }).click();
      await page.getByLabel('Search exercises').fill(name);
      await expectLayoutFits(page);
      await page.getByRole('button', { name: new RegExp(name) }).click();
      await expectLayoutFits(page);
      await page.getByRole('button', { name: 'Review workout' }).click();
      await expect(page.getByRole('heading', { name: 'Workout overview' })).toBeVisible();
      await expectLayoutFits(page);
      await page.getByRole('button', { name: `Edit ${name}` }).click();
      await expectLayoutFits(page);
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Start workout' }).click();
      await expect(page.getByRole('button', { name: 'Complete set' })).toBeEnabled({ timeout: 10000 });
      await expectLayoutFits(page);
      await expectTextOnOneLine(page.getByRole('button', { name: 'Pause workout' }));
      await expectTextOnOneLine(page.getByLabel('Elapsed time'));
      await expectTextOnOneLine(page.getByRole('button', { name: `Skip ${name}` }));
      await expectTextOnOneLine(page.locator('.current .badge'));
      await page.getByRole('button', { name: `About ${name}` }).first().click();
      await expectLayoutFits(page);
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Complete set' }).click();
      await expect(page.getByRole('timer', { name: 'Rest' })).toBeVisible();
      await expectLayoutFits(page);
      await page.getByRole('button', { name: 'Skip rest' }).click();
      await page.getByRole('button', { name: 'Finish workout' }).click();
      await expect(page.getByRole('heading', { name: workout })).toBeVisible();
      await expectLayoutFits(page);
    });
  });
}

for (const setType of ['Superset', 'HIIT']) {
  test(`${setType} with long exercise names fits at 320px`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    const name = 'ExtraordinarilyLongUnbrokenExerciseNameForNarrowScreenTesting';
    await page.goto('./#/exercises');
    await page.getByRole('button', { name: 'Add custom exercise' }).click();
    await page.getByLabel('Name', { exact: true }).fill(name);
    await page.getByRole('combobox', { name: 'Type', exact: true }).selectOption('bodyweight');
    await page.getByRole('group', { name: 'Primary muscles' }).getByRole('button', { name: 'Chest' }).click();
    await page.getByRole('button', { name: 'Save exercise' }).click();
    await expect(page.getByRole('link', { name: new RegExp(name) })).toBeVisible();

    await page.goto('./#/build');
    await page.getByRole('button', { name: 'Add exercise' }).click();
    await page.getByRole('group', { name: 'Add as' }).getByRole('button', { name: setType }).click();
    await page.getByLabel('Search exercises').fill(name);
    await page.getByRole('button', { name: new RegExp(name) }).click();
    await page.getByRole('button', { name: 'Add exercise' }).click();
    await page.getByLabel('Add to group').selectOption('A');
    await page.getByLabel('Search exercises').fill('Push-up');
    await page.getByRole('button', { name: /^Push-up / }).first().click();
    await page.getByRole('button', { name: 'Review workout' }).click();
    await expect(page.getByTestId('bracket')).toBeVisible();
    await expectLayoutFits(page);
    if (setType === 'HIIT') {
      await expectTextOnOneLine(page.getByTestId('hiit-work').getByText('seconds', { exact: true }));
    }
    await page.getByRole('button', { name: 'Start workout' }).click();
    await expect(page.getByRole('button', { name: 'Complete set' })).toBeEnabled({ timeout: 10000 });
    await expectLayoutFits(page);
    await expectTextOnOneLine(page.getByRole('button', { name: `Skip ${name}` }));
    await expectTextOnOneLine(page.locator('.current .badge'));
    await page.getByRole('button', { name: 'Complete set' }).click();
    await expect(page.getByRole('heading', { name: /About Push-up/ })).toBeVisible();
    await expectLayoutFits(page);
    await page.getByRole('button', { name: 'Complete set' }).click();
    await expect(page.getByRole('timer', { name: 'Rest' })).toBeVisible();
    await expectLayoutFits(page);
  });
}
