import { test } from '@playwright/test';

test('Capture 신규스펙개발 pipeline', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://localhost:3000/pipelines/generic/' + encodeURIComponent('신규스펙개발'));
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'test-results/60-newspec-pipeline.png', fullPage: true });
});

test('Capture new session form with 신규스펙개발', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://localhost:3000/sessions/new');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  await page.locator('button').filter({ hasText: '선택' }).first().click();
  await page.waitForTimeout(400);
  await page.getByRole('option', { name: /신규스펙개발/ }).click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'test-results/61-newspec-form.png', fullPage: true });
});

test('Capture QA티켓 병렬 처리 pipeline', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://localhost:3000/pipelines/generic/' + encodeURIComponent('QA티켓 병렬 처리'));
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'test-results/62-qa-pipeline.png', fullPage: true });
});
