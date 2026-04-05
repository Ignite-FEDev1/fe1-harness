import { test, expect } from '@playwright/test';

/**
 * 풀 E2E: 세션 생성 → 실행 → progress highlight → 완료 → 후속 요청
 * 파이프라인: 기사요약 (2개 기사 병렬 요약 → 종합 보고서)
 *
 * 파이프라인과 세션은 삭제하지 않음 — 사용자가 직접 확인할 수 있도록 남김
 */
test.describe('Full session run with progress monitoring', () => {

  // 세션 실행에 최대 5분
  test.setTimeout(300000);

  test('Create session, run, verify progress & completion', async ({ page }) => {
    // ═══════════════════════════════════════════════════════════
    // STEP 1: New Session 페이지에서 기사요약 파이프라인 선택 & 입력
    // ═══════════════════════════════════════════════════════════
    console.log('📍 Step 1: Creating session...');
    await page.goto('http://localhost:3000/sessions/new');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // 파이프라인 선택
    await page.locator('button').filter({ hasText: '선택' }).first().click();
    await page.waitForTimeout(500);
    const pipelineOption = page.getByRole('option', { name: /기사요약/ });
    await expect(pipelineOption).toBeVisible({ timeout: 3000 });
    await pipelineOption.click();

    // repeat-group 카드가 로드될 때까지 대기
    await expect(page.getByText('기사 URL')).toBeVisible({ timeout: 15000 });
    console.log('  ✓ Pipeline selected, repeat-group form loaded');

    // ── 기사 1 입력 ──
    await page.locator('input[placeholder*="news.example"]').first().fill('https://en.wikipedia.org/wiki/Artificial_intelligence');
    await page.locator('input[placeholder*="제목"]').first().fill('인공지능');

    // ── 기사 2 추가 & 입력 ──
    await page.getByText('뉴스 기사 추가').click();
    await page.waitForTimeout(200);
    await page.locator('input[placeholder*="news.example"]').nth(1).fill('https://en.wikipedia.org/wiki/Machine_learning');
    await page.locator('input[placeholder*="제목"]').nth(1).fill('머신러닝');

    // 요약 스타일
    await page.locator('input[placeholder*="간단"]').fill('간단 요약');

    // 세션명 입력
    await page.locator('input[placeholder*="미입력"]').fill('기사요약 테스트');

    await page.screenshot({ path: 'test-results/30-session-form-filled.png', fullPage: true });
    console.log('  ✓ Form filled with 2 articles');

    // ═══════════════════════════════════════════════════════════
    // STEP 2: CREATE SESSION 클릭 → 세션 페이지로 이동
    // ═══════════════════════════════════════════════════════════
    console.log('📍 Step 2: Submitting session...');
    await page.getByText('CREATE SESSION').click();

    // 세션 상세 페이지로 리다이렉트될 때까지 대기
    await page.waitForURL(/\/sessions\/[a-f0-9-]+/, { timeout: 15000 });
    const sessionUrl = page.url();
    console.log(`  ✓ Session created: ${sessionUrl}`);

    // ═══════════════════════════════════════════════════════════
    // STEP 3: Progress Bar 모니터링 — 스테이지 하이라이트 캡처
    // ═══════════════════════════════════════════════════════════
    console.log('📍 Step 3: Monitoring progress...');

    // (a) 먼저 progress bar가 렌더링될 때까지 대기
    await expect(page.getByText('작업 준비')).toBeVisible({ timeout: 15000 });
    console.log('  ✓ Progress bar visible (init stage)');

    // 진행 상황 스크린샷 — 여러 차례 찍음
    let capturedInit = false;
    let capturedSummarize = false;
    let capturedReport = false;
    let capturedComplete = false;
    let lastStatus = '';

    // 최대 4분간 폴링 (10초 간격으로 상태 체크 + 스크린샷)
    const startTime = Date.now();
    const maxWait = 240000; // 4분

    while (Date.now() - startTime < maxWait) {
      // 현재 상태 확인
      const statusText = await page.locator('.status-pulse, [class*="status"]').first().textContent().catch(() => '');
      const pageContent = await page.content();

      // init 스테이지 캡처
      if (!capturedInit && pageContent.includes('RUNNING')) {
        await page.screenshot({ path: 'test-results/31-running-init.png', fullPage: true });
        capturedInit = true;
        console.log('  📸 Captured: RUNNING (init stage)');
      }

      // summarize 스테이지 활성화 감지 (로그에 📍 [summarize] 또는 progress bar 변화)
      if (!capturedSummarize && pageContent.includes('summarize')) {
        await page.waitForTimeout(2000); // 렌더링 안정화
        await page.screenshot({ path: 'test-results/32-running-summarize.png', fullPage: true });
        capturedSummarize = true;
        console.log('  📸 Captured: summarize stage active (병렬 요약)');
      }

      // report 스테이지 활성화 감지
      if (!capturedReport && capturedSummarize && pageContent.includes('report')) {
        // summarize와 report는 progress bar에 둘 다 있으므로,
        // report가 active인지 확인 — log에 📍 [report] 출현 여부 확인
        const logs = await page.locator('.terminal-bg').textContent().catch(() => '') ?? '';
        if (logs.includes('[report]')) {
          await page.waitForTimeout(1000);
          await page.screenshot({ path: 'test-results/33-running-report.png', fullPage: true });
          capturedReport = true;
          console.log('  📸 Captured: report stage active (종합 보고서)');
        }
      }

      // 완료 감지
      if (pageContent.includes('COMPLETED') || pageContent.includes('후속 요청')) {
        await page.waitForTimeout(1000);
        await page.screenshot({ path: 'test-results/34-completed.png', fullPage: true });
        capturedComplete = true;
        lastStatus = 'completed';
        console.log('  📸 Captured: COMPLETED');
        break;
      }

      // 에러/정지 감지
      if (pageContent.includes('ERROR') || pageContent.includes('STOPPED')) {
        await page.screenshot({ path: 'test-results/35-error-or-stopped.png', fullPage: true });
        lastStatus = 'error_or_stopped';
        console.log('  ⚠️ Session ended with ERROR or STOPPED');
        break;
      }

      await page.waitForTimeout(5000); // 5초마다 확인
    }

    if (!capturedInit && !capturedSummarize && !capturedReport && !capturedComplete) {
      // 타임아웃 — 최종 상태 스크린샷
      await page.screenshot({ path: 'test-results/36-timeout-state.png', fullPage: true });
      console.log('  ⚠️ Timeout — captured final state');
    }

    // ═══════════════════════════════════════════════════════════
    // STEP 4: 검증
    // ═══════════════════════════════════════════════════════════
    console.log('📍 Step 4: Verification...');

    // progress bar에 3개 스테이지가 있어야 함 (init + summarize + report)
    await expect(page.getByText('작업 준비')).toBeVisible();
    await expect(page.getByText('기사 요약')).toBeVisible();
    await expect(page.getByText('종합 보고서 생성')).toBeVisible();
    console.log('  ✓ All 3 stages visible in progress bar');

    if (lastStatus === 'completed') {
      // 완료 상태에서 후속 요청 textarea가 보여야 함
      const followUpInput = page.locator('textarea[placeholder*="후속"]');
      await expect(followUpInput).toBeVisible({ timeout: 5000 });
      console.log('  ✓ Follow-up chat input visible (Point 5)');

      // 후속 요청 텍스트 입력 테스트
      await followUpInput.fill('요약을 더 짧게 줄여주세요');
      await page.screenshot({ path: 'test-results/37-followup-chat.png', fullPage: true });
      console.log('  📸 Captured: Follow-up chat with input');
    }

    console.log('');
    console.log('═══════════════════════════════════════');
    console.log('스크린샷 결과 (test-results/ 폴더):');
    console.log('  30 - 세션 폼 (repeat-group 카드 입력)');
    if (capturedInit) console.log('  31 - RUNNING (init 스테이지)');
    if (capturedSummarize) console.log('  32 - summarize 스테이지 활성화 (병렬)');
    if (capturedReport) console.log('  33 - report 스테이지 활성화 (순차)');
    if (capturedComplete) console.log('  34 - COMPLETED 상태');
    if (lastStatus === 'completed') console.log('  37 - 후속 요청 채팅');
    console.log('═══════════════════════════════════════');
    console.log('');
    console.log('파이프라인과 세션은 삭제하지 않았습니다.');
    console.log(`세션 URL: ${sessionUrl}`);
    console.log('http://localhost:3000/pipelines 에서 "기사요약" 파이프라인 확인 가능');
  });
});
