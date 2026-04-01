import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');

  if (!projectId) {
    return NextResponse.json(
      { error: 'projectId is required' },
      { status: 400 },
    );
  }

  const token = process.env.GITLAB_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: 'GITLAB_TOKEN not configured' },
      { status: 500 },
    );
  }

  try {
    const response = await fetch(
      `https://gitlab.com/api/v4/projects/${encodeURIComponent(projectId)}/repository/branches?per_page=100`,
      {
        headers: {
          'PRIVATE-TOKEN': token,
        },
      },
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: `GitLab API error: ${response.status}` },
        { status: response.status },
      );
    }

    const branches = await response.json();
    return NextResponse.json(branches);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
