import { test, expect } from '@playwright/test';

test.describe('Pipeline UX - repeat-group input and session flow', () => {

  test('Point 2: Pipeline editor shows stages, input schema, and execution plan', async ({ page }) => {
    await page.goto('http://localhost:3000/pipelines/generic/' + encodeURIComponent('QA티켓 병렬 처리'));

    // Wait for stages to load - use first() to avoid strict mode
    await expect(page.getByText('process-ticket').first()).toBeVisible({ timeout: 10000 });

    await page.screenshot({ path: 'test-results/02-pipeline-editor.png', fullPage: true });

    // Verify INPUT SCHEMA section is visible
    await expect(page.getByText('INPUT SCHEMA')).toBeVisible();
    await expect(page.getByText('repeat-group')).toBeVisible();

    // Verify EXECUTION PLAN PREVIEW is visible
    await expect(page.getByText('EXECUTION PLAN PREVIEW')).toBeVisible();

    // Verify STAGE PROMPTS section
    await expect(page.getByText('STAGE PROMPTS')).toBeVisible();

    console.log('✅ Point 2 PASS: Pipeline editor shows stages, input schema, and execution plan');
  });

  test('Point 3: New Session form shows user-friendly repeat-group cards', async ({ page }) => {
    await page.goto('http://localhost:3000/sessions/new');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Click the pipeline select trigger
    const pipelineSelect = page.locator('button').filter({ hasText: '선택' }).first();
    await pipelineSelect.click();
    await page.waitForTimeout(500);

    // Click on the QA option using role-based selector
    const qaOption = page.getByRole('option', { name: /QA티켓 병렬 처리/ });
    await expect(qaOption).toBeVisible({ timeout: 3000 });
    await qaOption.click();

    // Wait for schema to load - wait until "티켓 URL" sub-field is visible
    await expect(page.getByText('티켓 URL')).toBeVisible({ timeout: 15000 });

    await page.screenshot({ path: 'test-results/04-new-session-pipeline-selected.png', fullPage: true });

    // Verify repeat-group card is visible
    await expect(page.getByText('#1')).toBeVisible();

    // Verify card sub-fields are visible
    await expect(page.getByText('티켓 URL')).toBeVisible();
    await expect(page.getByText('작업 브랜치')).toBeVisible();
    await expect(page.getByText('베이스 브랜치')).toBeVisible();
    await expect(page.getByText('요청사항')).toBeVisible();

    // Verify "추가" button is visible
    await expect(page.getByText('QA 티켓 추가')).toBeVisible();

    // Verify NO JSON textarea for tickets
    const jsonPlaceholders = page.locator('textarea[placeholder*="JSON"]');
    await expect(jsonPlaceholders).toHaveCount(0);

    // Fill in the first ticket card
    await page.locator('input[placeholder*="jira"]').first().fill('https://jira.example.com/browse/QA-1');
    await page.locator('input[placeholder*="feature"]').first().fill('feature/qa-1');
    await page.locator('input[placeholder="main"]').first().fill('main');
    await page.locator('input[placeholder*="수정"]').first().fill('버튼 색상 변경');

    // Add second ticket
    await page.getByText('QA 티켓 추가').click();
    await page.waitForTimeout(200);
    await expect(page.getByText('#2')).toBeVisible();

    // Fill merge branch
    await page.locator('input[placeholder*="release"]').first().fill('release/2026-04-sprint1');

    await page.waitForTimeout(300);
    await page.screenshot({ path: 'test-results/05-new-session-filled.png', fullPage: true });

    // Verify count display
    await expect(page.getByText('2개 등록')).toBeVisible();

    // Verify CREATE SESSION button is enabled
    await expect(page.getByText('CREATE SESSION')).toBeEnabled();

    console.log('✅ Point 3 PASS: New Session shows user-friendly repeat-group cards, no JSON input');
  });

  test('Point 2+: Orchestrator page is accessible', async ({ page }) => {
    await page.goto('http://localhost:3000/pipelines/orchestrator');

    const textarea = page.locator('textarea').first();
    await expect(textarea).toBeVisible({ timeout: 10000 });

    await page.waitForFunction(
      () => {
        const ta = document.querySelector('textarea');
        return ta && ta.value.length > 100;
      },
      { timeout: 10000 },
    );

    await page.screenshot({ path: 'test-results/06-orchestrator-page.png', fullPage: true });
    await expect(page.getByText('SYSTEM')).toBeVisible();

    const content = await textarea.inputValue();
    expect(content).toContain('오케스트레이터');

    console.log('✅ Point 2+ PASS: Orchestrator page is accessible and shows content');
  });

  test('AI panel toggle works on pipeline editor', async ({ page }) => {
    await page.goto('http://localhost:3000/pipelines/generic/' + encodeURIComponent('QA티켓 병렬 처리'));
    await expect(page.getByText('process-ticket').first()).toBeVisible({ timeout: 10000 });

    // AI panel should be visible initially
    await expect(page.getByText('AI 편집 어시스턴트')).toBeVisible();

    // Click toggle to close
    await page.locator('button[title*="AI 어시스턴트"]').click();
    await page.waitForTimeout(300);
    await expect(page.getByText('AI 편집 어시스턴트')).not.toBeVisible();

    await page.screenshot({ path: 'test-results/07-ai-panel-collapsed.png', fullPage: true });

    // Click toggle to open
    await page.locator('button[title*="AI 어시스턴트"]').click();
    await page.waitForTimeout(300);
    await expect(page.getByText('AI 편집 어시스턴트')).toBeVisible();

    console.log('✅ AI Panel toggle PASS');
  });
});
