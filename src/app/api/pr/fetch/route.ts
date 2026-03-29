import { NextRequest, NextResponse } from 'next/server';

const GITHUB_API_URL = 'https://api.github.com';

function parsePRInput(prUrlOrNumber: string): { prNumber: string; repo: string; baseUrl: string } | null {
  // Full GitHub.com URL: https://github.com/owner/repo/pull/123
  const githubMatch = prUrlOrNumber.match(/https?:\/\/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)/);
  if (githubMatch) {
    return { repo: githubMatch[1], prNumber: githubMatch[2], baseUrl: GITHUB_API_URL };
  }
  // Generic GitHub Enterprise URL: https://hostname/owner/repo/pull/123
  const gheMatch = prUrlOrNumber.match(/https?:\/\/([^/]+)\/([^/]+\/[^/]+)\/pull\/(\d+)/);
  if (gheMatch) {
    return { repo: gheMatch[2], prNumber: gheMatch[3], baseUrl: `https://${gheMatch[1]}/api/v3` };
  }
  // owner/repo#123 shorthand
  const shorthand = prUrlOrNumber.match(/^([^/]+\/[^/]+)#(\d+)$/);
  if (shorthand) {
    return { repo: shorthand[1], prNumber: shorthand[2], baseUrl: GITHUB_API_URL };
  }
  return null;
}

export async function POST(req: NextRequest) {
  const { prUrl, token } = await req.json();
  const parsed = parsePRInput(prUrl);
  if (!parsed) {
    return NextResponse.json(
      { error: 'Invalid PR URL. Use a full GitHub PR URL (e.g. https://github.com/owner/repo/pull/123) or owner/repo#number shorthand.' },
      { status: 400 }
    );
  }
  const { prNumber, repo, baseUrl } = parsed;
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `token ${token}`;
  try {
    const prRes = await fetch(`${baseUrl}/repos/${repo}/pulls/${prNumber}`, {
      headers,
      cache: 'no-store',
    });
    if (!prRes.ok) {
      return NextResponse.json({ error: `Failed to fetch PR details for ${repo}#${prNumber}. Check the URL and token.` }, { status: prRes.status });
    }
    const prData = await prRes.json();
    const diffRes = await fetch(`${baseUrl}/repos/${repo}/pulls/${prNumber}`, {
      headers: { ...headers, Accept: 'application/vnd.github.v3.diff' },
      cache: 'no-store',
    });
    if (!diffRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch PR diff.' }, { status: diffRes.status });
    }
    const diff = await diffRes.text();
    return NextResponse.json({ prUrl, prNumber, repo, baseUrl, details: prData, diff });
  } catch (err) {
    return NextResponse.json({ error: 'Unexpected error fetching PR.' }, { status: 500 });
  }
} 