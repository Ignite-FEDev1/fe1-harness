import { test, expect } from '@playwright/test';

/**
 * Full E2E: create-pipeline API로 파이프라인 생성 → 에디터 확인 → 세션 폼 확인
 *
 * 시나리오: N개의 뉴스 기사 URL+제목 → 병렬 요약 → 종합 보고서
 */
test.describe('Create-to-Session full flow', () => {

  // 생성에 시간이 오래 걸릴 수 있으므로 3분
  test.setTimeout(180000);

  let generatedPipelineName = '';

  test.afterAll(async ({ request }) => {
    // 테스트 파이프라인 정리
    if (generatedPipelineName) {
      await request.delete(
        `http://localhost:3000/api/pipelines/generic/${encodeURIComponent(generatedPipelineName)}`,
      );
      console.log(`🧹 Cleaned up: "${generatedPipelineName}"`);
    }
  });

  test('Step 1: Generate pipeline via create-pipeline API', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');

    console.log('📍 Calling generate API (claude-max, sonnet)...');

    // 대화 내용을 시뮬레이션해서 generate API 호출
    const result = await page.evaluate(async () => {
      const conversation = [
        {
          role: 'user' as const,
          content: `기사요약 파이프라인을 만들어주세요.

입력:
- N개의 뉴스 기사 (각각 URL과 제목을 입력받음)
- 요약 스타일 지정 (간단 요약 / 상세 요약 중 선택)

처리 단계:
1단계 (병렬): 각 기사를 개별적으로 요약. URL에 접근하여 내용을 읽고 한 문단으로 요약
2단계 (순차): 모든 기사 요약을 합쳐서 하나의 종합 브리핑 보고서 생성

파이프라인 이름: 기사요약`,
        },
        {
          role: 'assistant' as const,
          content:
            '네, 이해했습니다. N개의 기사를 병렬로 요약한 뒤 종합 보고서를 만드는 "기사요약" 파이프라인을 생성하겠습니다.',
        },
        {
          role: 'user' as const,
          content: '네, 만들어주세요.',
        },
      ];

      try {
        const res = await fetch('/api/create-pipeline/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: conversation,
            apiMode: 'claude-max',
            model: 'claude-sonnet-4-6',
          }),
        });

        if (!res.ok) {
          const text = await res.text();
          return { pipelineName: '', error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
        }

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        // SSE 스트림 전체 수신
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
        }

        // SSE 이벤트 파싱
        let pipelineName = '';
        let error = '';
        const blocks = buffer.split('\n\n');

        for (const block of blocks) {
          if (!block.trim()) continue;
          let eventType = '';
          let dataStr = '';
          for (const line of block.split('\n')) {
            if (line.startsWith('event:')) eventType = line.slice(6).trim();
            if (line.startsWith('data:')) dataStr += line.slice(5);
          }
          if (!dataStr.trim()) continue;
          try {
            const data = JSON.parse(dataStr.trim());
            if (eventType === 'done' && data.pipelineName) pipelineName = data.pipelineName;
            if (eventType === 'error' && data.message) error = data.message;
          } catch { /* skip */ }
        }

        return { pipelineName, error };
      } catch (err) {
        return { pipelineName: '', error: String(err) };
      }
    });

    console.log('Generate result:', JSON.stringify(result));

    // 에러가 있으면 출력 후 실패
    if (result.error) {
      console.error('❌ Generation error:', result.error);
    }
    expect(result.error).toBeFalsy();
    expect(result.pipelineName).toBeTruthy();

    generatedPipelineName = result.pipelineName;
    console.log(`✅ Pipeline "${generatedPipelineName}" generated`);
  });

  test('Step 2: Verify generated pipeline has correct structure', async ({ page }) => {
    expect(generatedPipelineName).toBeTruthy();

    await page.goto('http://localhost:3000');
    const pipelineData = await page.evaluate(async (name: string) => {
      const res = await fetch(`/api/pipelines/generic/${encodeURIComponent(name)}`);
      if (!res.ok) return null;
      return res.json();
    }, generatedPipelineName);

    console.log('Pipeline data:', JSON.stringify(pipelineData, null, 2));

    expect(pipelineData).toBeTruthy();

    // ── stages 검증 ──
    expect(pipelineData.stages).toBeTruthy();
    expect(pipelineData.stages.length).toBeGreaterThanOrEqual(2);

    // 병렬 스테이지가 있어야 함
    const parallelStage = pipelineData.stages.find((s: { parallel?: string }) => s.parallel);
    expect(parallelStage).toBeTruthy();
    console.log(`  병렬 스테이지: ${parallelStage.id} (parallel: ${parallelStage.parallel})`);

    // 순차 스테이지(combine/merge 등)가 있어야 함
    const sequentialStages = pipelineData.stages.filter((s: { parallel?: string }) => !s.parallel);
    expect(sequentialStages.length).toBeGreaterThanOrEqual(1);
    console.log(`  순차 스테이지: ${sequentialStages.map((s: { id: string }) => s.id).join(', ')}`);

    // ── input-schema 검증 ──
    expect(pipelineData.inputSchema).toBeTruthy();
    expect(pipelineData.inputSchema.fields).toBeTruthy();
    expect(pipelineData.inputSchema.fields.length).toBeGreaterThan(0);

    // repeat-group 타입 필드가 있어야 함 (N개의 기사 입력)
    const repeatGroupField = pipelineData.inputSchema.fields.find(
      (f: { type: string }) => f.type === 'repeat-group',
    );
    expect(repeatGroupField).toBeTruthy();
    console.log(`  repeat-group 필드: ${repeatGroupField.id} (${repeatGroupField.label})`);

    // repeat-group에 하위 필드가 있어야 함
    expect(repeatGroupField.fields).toBeTruthy();
    expect(repeatGroupField.fields.length).toBeGreaterThan(0);
    console.log(
      `  하위 필드: ${repeatGroupField.fields.map((f: { id: string }) => f.id).join(', ')}`,
    );

    // JSON textarea가 없어야 함
    const jsonTextarea = pipelineData.inputSchema.fields.find(
      (f: { type: string; placeholder?: string }) =>
        f.type === 'textarea' && f.placeholder?.toLowerCase().includes('json'),
    );
    expect(jsonTextarea).toBeUndefined();

    // parallel 스테이지의 필드명이 input-schema의 repeat-group 필드 id와 일치
    expect(parallelStage.parallel).toBe(repeatGroupField.id);
    console.log(`  parallel↔repeat-group 연결: ${parallelStage.parallel} ✓`);

    console.log('✅ Step 2 PASS: Pipeline structure is correct');
  });

  test('Step 3: Pipeline editor shows stages and input schema', async ({ page }) => {
    expect(generatedPipelineName).toBeTruthy();

    await page.goto(
      `http://localhost:3000/pipelines/generic/${encodeURIComponent(generatedPipelineName)}`,
    );

    // 스테이지가 로드될 때까지 대기
    await expect(page.getByText('INPUT SCHEMA')).toBeVisible({ timeout: 10000 });

    await page.screenshot({
      path: 'test-results/20-created-pipeline-editor.png',
      fullPage: true,
    });

    // INPUT SCHEMA에 repeat-group이 표시되어야 함
    await expect(page.getByText('repeat-group')).toBeVisible();

    // EXECUTION PLAN PREVIEW가 있어야 함
    await expect(page.getByText('EXECUTION PLAN PREVIEW')).toBeVisible();

    // STAGE PROMPTS가 있어야 함
    await expect(page.getByText('STAGE PROMPTS')).toBeVisible();

    console.log('✅ Step 3 PASS: Pipeline editor displays correctly');
  });

  test('Step 4: New Session form renders user-friendly repeat-group input', async ({ page }) => {
    expect(generatedPipelineName).toBeTruthy();

    // 파이프라인 데이터 조회
    await page.goto('http://localhost:3000');
    const pipelineData = await page.evaluate(async (name: string) => {
      const res = await fetch(`/api/pipelines/generic/${encodeURIComponent(name)}`);
      return res.json();
    }, generatedPipelineName);

    const repeatGroupField = pipelineData.inputSchema.fields.find(
      (f: { type: string }) => f.type === 'repeat-group',
    );

    // 새 세션 페이지로 이동
    await page.goto('http://localhost:3000/sessions/new');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // 파이프라인 선택
    const selectTrigger = page.locator('button').filter({ hasText: '선택' }).first();
    await selectTrigger.click();
    await page.waitForTimeout(500);

    const option = page.getByRole('option', { name: new RegExp(generatedPipelineName) });
    await expect(option).toBeVisible({ timeout: 3000 });
    await option.click();

    // repeat-group의 첫 번째 하위 필드가 나타날 때까지 대기
    const firstSubLabel = repeatGroupField.fields[0].label;
    await expect(page.getByText(firstSubLabel)).toBeVisible({ timeout: 15000 });

    await page.screenshot({
      path: 'test-results/21-created-pipeline-session-form.png',
      fullPage: true,
    });

    // ── 핵심 검증: 사용자 친화적 UI ──

    // 1. repeat-group 카드가 보여야 함 (#1 배지)
    await expect(page.getByText('#1')).toBeVisible();

    // 2. 각 하위 필드가 개별 input으로 렌더링되어야 함
    for (const subField of repeatGroupField.fields) {
      await expect(page.getByText(subField.label)).toBeVisible();
    }

    // 3. "추가" 버튼이 있어야 함
    const addBtn = page.getByText(new RegExp(`${repeatGroupField.label}.*추가`));
    await expect(addBtn).toBeVisible();

    // 4. JSON 입력을 요구하는 textarea가 없어야 함
    const jsonTextarea = page.locator('textarea[placeholder*="JSON"], textarea[placeholder*="json"]');
    await expect(jsonTextarea).toHaveCount(0);

    // ── 실제 데이터 입력 테스트 ──

    // 첫 번째 카드에 데이터 입력
    const firstPlaceholder = repeatGroupField.fields[0].placeholder;
    if (firstPlaceholder) {
      const firstInput = page.locator(`input[placeholder="${firstPlaceholder}"]`).first();
      if (await firstInput.isVisible().catch(() => false)) {
        await firstInput.fill('https://news.example.com/article-1');
      }
    }

    // 두 번째 카드 추가
    await addBtn.click();
    await page.waitForTimeout(200);
    await expect(page.getByText('#2')).toBeVisible();

    await page.screenshot({
      path: 'test-results/22-created-pipeline-session-filled.png',
      fullPage: true,
    });

    // 카운터 표시 확인
    await expect(page.getByText('2개 등록')).toBeVisible();

    console.log('✅ Step 4 PASS: Session form renders user-friendly repeat-group');
  });
});
