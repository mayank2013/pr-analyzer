import { NextRequest, NextResponse } from 'next/server';

const GITHUB_API_URL = 'https://api.github.com';

function parsePRInput(prUrlOrNumber: string): { prNumber: string; repo: string; baseUrl: string } | null {
  const githubMatch = prUrlOrNumber.match(/https?:\/\/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)/);
  if (githubMatch) {
    return { repo: githubMatch[1], prNumber: githubMatch[2], baseUrl: GITHUB_API_URL };
  }
  const gheMatch = prUrlOrNumber.match(/https?:\/\/([^/]+)\/([^/]+\/[^/]+)\/pull\/(\d+)/);
  if (gheMatch) {
    return { repo: gheMatch[2], prNumber: gheMatch[3], baseUrl: `https://${gheMatch[1]}/api/v3` };
  }
  const shorthand = prUrlOrNumber.match(/^([^/]+\/[^/]+)#(\d+)$/);
  if (shorthand) {
    return { repo: shorthand[1], prNumber: shorthand[2], baseUrl: GITHUB_API_URL };
  }
  return null;
}

export async function POST(req: NextRequest) {
  const { prUrl, token, comments } = await req.json();
  const parsed = parsePRInput(prUrl);
  if (!parsed) {
    return NextResponse.json({ error: 'Invalid PR URL or number.' }, { status: 400 });
  }
  const { prNumber, repo, baseUrl } = parsed;
  try {
    const prRes = await fetch(`${baseUrl}/repos/${repo}/pulls/${prNumber}`, {
      headers: { Authorization: `token ${token}` },
      cache: 'no-store',
    });
    if (!prRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch PR details.' }, { status: prRes.status });
    }
    const prData = await prRes.json();
    const commitId = prData.head?.sha;
    if (!commitId) {
      return NextResponse.json({ error: 'Could not determine commit SHA.' }, { status: 400 });
    }

    let posted = 0;
    const errors: string[] = [];

    for (const c of comments) {
      const path = c.file || 'unknown';
      const line = c.line || 1;

      // Use the pull request review comment API with `line` + `side` (newer API)
      const res = await fetch(`${baseUrl}/repos/${repo}/pulls/${prNumber}/comments`, {
        method: 'POST',
        headers: {
          Authorization: `token ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          body: c.comment,
          commit_id: commitId,
          path,
          line,
          side: 'RIGHT',
        }),
      });

      if (res.ok) {
        posted++;
      } else {
        const errText = await res.text().catch(() => '');
        console.error(`Failed to post comment on ${path}:${line}:`, errText);

        // Retry with position-based API as fallback
        const retryRes = await fetch(`${baseUrl}/repos/${repo}/pulls/${prNumber}/comments`, {
          method: 'POST',
          headers: {
            Authorization: `token ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            body: c.comment,
            commit_id: commitId,
            path,
            position: 1,
          }),
        });

        if (retryRes.ok) {
          posted++;
        } else {
          const retryErr = await retryRes.text().catch(() => '');
          errors.push(`${path}:${line} - ${retryErr}`);
        }
      }
    }

    return NextResponse.json({
      success: posted > 0,
      posted,
      total: comments.length,
      ...(errors.length > 0 && { errors }),
    });
  } catch (err) {
    return NextResponse.json({ error: 'Unexpected error posting comments.' }, { status: 500 });
  }
}
