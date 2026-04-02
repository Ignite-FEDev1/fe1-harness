'use client';

import { useEffect, useState, use } from 'react';
import { StreamingView } from '@/components/streaming/StreamingView';
import { PipelineStage } from '@/components/streaming/ProgressBar';
import { useUser } from '@/contexts/UserContext';
import { STAGE_LABELS } from '@/lib/pipeline/progress-parser';

interface Session {
  id: string;
  name: string;
  status: string;
  current_step: number | null;
  form_data: Record<string, unknown>;
  projects?: { name: string; project_path: string } | null;
  active_stage_id?: string | null;
}

export default function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { selectedUser, apiMode, currentModel } = useUser();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [stages, setStages] = useState<PipelineStage[]>([]);

  useEffect(() => {
    fetch(`/api/sessions/${id}`)
      .then((res) => res.json())
      .then((data) => setSession(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  // Fetch pipeline stages
  useEffect(() => {
    if (!session) return;
    const formData = session.form_data;

    const INIT_STAGE: PipelineStage = { id: 'init', label: '작업 준비' };

    // Case 1: generic_pipeline directly on session (no project config needed)
    const directGeneric = formData.generic_pipeline as string | undefined;
    if (directGeneric) {
      fetch(`/api/pipelines/generic/${encodeURIComponent(directGeneric)}`)
        .then((r) => r.json())
        .then((pData) => {
          if (Array.isArray(pData.stages) && pData.stages.length > 0) {
            setStages([
              INIT_STAGE,
              ...(pData.stages as { id: string; label?: string; parallelGroup?: string }[]).map((s) => ({
                id: s.id,
                label: s.label ?? STAGE_LABELS[s.id] ?? s.id,
                parallelGroup: s.parallelGroup,
              })),
            ]);
          } else {
            setStages([INIT_STAGE]);
          }
        })
        .catch(() => {});
      return;
    }

    // Case 2: project-based config (project_slug + task_type)
    const slug = formData.project_slug as string | undefined;
    const taskType = formData.task_type as string | undefined;
    if (!slug || !taskType) {
      setStages([INIT_STAGE]);
      return;
    }

    fetch(`/api/pipelines/projects/${encodeURIComponent(slug)}/${encodeURIComponent(taskType)}`)
      .then((r) => r.json())
      .then(async (data) => {
        const config = data?.config;
        if (!config?.stages) return;

        // If config references a generic pipeline, load stages from pipeline.json
        const genericPipeline = config.genericPipeline as string | undefined;
        if (genericPipeline) {
          try {
            const pRes = await fetch(`/api/pipelines/generic/${encodeURIComponent(genericPipeline)}`);
            const pData = await pRes.json();
            if (Array.isArray(pData.stages) && pData.stages.length > 0) {
              const enabledSet = new Set(
                (config.stages as { id: string; enabled: boolean }[])
                  .filter((s) => s.enabled)
                  .map((s) => s.id),
              );
              const projectIds = new Set((config.stages as { id: string }[]).map((s) => s.id));
              const hasCustomIds = pData.stages.some((s: { id: string }) => !projectIds.has(s.id));
              setStages([
                INIT_STAGE,
                ...(pData.stages as { id: string; label?: string; parallelGroup?: string }[])
                  .filter((s) => hasCustomIds || enabledSet.has(s.id))
                  .map((s) => ({ id: s.id, label: s.label ?? STAGE_LABELS[s.id] ?? s.id, parallelGroup: s.parallelGroup })),
              ]);
              return;
            }
          } catch {
            // fall through
          }
        }

        setStages([
          INIT_STAGE,
          ...(config.stages as { id: string; enabled: boolean }[])
            .filter((s) => s.enabled)
            .map((s) => ({ id: s.id, label: STAGE_LABELS[s.id] ?? s.id })),
        ]);
      })
      .catch(() => {});
  }, [session]);

  const handleRun = async (additionalNotes?: string) => {
    // Prefer api_mode stored in session form_data, fall back to global apiMode
    const formApiMode =
      (session?.form_data?.api_mode as string | undefined) ?? apiMode;

    const res = await fetch(`/api/sessions/${id}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: selectedUser?.id ?? null,
        apiMode: formApiMode,
        model: currentModel,
        additionalNotes,
      }),
    });
    if (res.ok) {
      setSession((prev) => (prev ? { ...prev, status: 'running' } : prev));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          LOADING...
        </span>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-xs" style={{ color: 'var(--accent-red)', fontFamily: 'var(--font-mono)' }}>
          SESSION NOT FOUND
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Session Header */}
      <div
        className="flex items-center gap-3 px-5 py-2.5"
        style={{ background: 'var(--bg-raised)', borderBottom: '1px solid var(--border-dim)' }}
      >
        <h1 className="text-sm font-medium" style={{ color: 'var(--text-bright)' }}>
          {session.name}
        </h1>
        {session.projects?.name && (
          <span
            className="text-xs px-2 py-0.5 rounded"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              color: 'var(--text-muted)',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-dim)',
            }}
          >
            {session.projects.name}
          </span>
        )}
        {session.form_data?.api_mode as string | undefined && (
          <span
            className="text-xs px-2 py-0.5 rounded"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              color: 'var(--text-muted)',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-dim)',
            }}
          >
            {String(session.form_data.api_mode ?? '').toUpperCase()}
          </span>
        )}
      </div>

      {/* Streaming View */}
      <div className="flex-1 overflow-hidden">
        <StreamingView
          sessionId={id}
          onRun={handleRun}
          sessionStatus={session.status}
          stages={stages}
          initialStageId={session.active_stage_id}
        />
      </div>
    </div>
  );
}
