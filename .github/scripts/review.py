"""
Fetches a GitHub PR diff, sends it to Claude for review,
and posts the suggestions as inline PR comments.

Required environment variables (set via GitHub Actions env/secrets):
  GITHUB_TOKEN      - provided automatically by Actions
  ANTHROPIC_API_KEY - add as a repository secret
  PR_NUMBER         - PR number (integer)
  REPO              - owner/repo string
  HEAD_SHA          - head commit SHA of the PR
"""

import json
import os
import sys
import urllib.error
import urllib.request

ANTHROPIC_API = "https://api.anthropic.com/v1/messages"
GITHUB_API    = "https://api.github.com"
MAX_DIFF_CHARS = 12_000
MAX_COMMENTS   = 10


def get_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        print(f"ERROR: environment variable {name!r} is not set.", file=sys.stderr)
        sys.exit(1)
    return value


def http_get(url: str, headers: dict) -> bytes:
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req) as resp:
        return resp.read()


def http_post(url: str, headers: dict, payload: dict) -> dict:
    data = json.dumps(payload).encode()
    req  = urllib.request.Request(url, data=data, headers=headers, method="POST")
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


def fetch_diff(repo: str, pr_number: str, token: str) -> str:
    url = f"{GITHUB_API}/repos/{repo}/pulls/{pr_number}"
    headers = {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github.v3.diff",
    }
    return http_get(url, headers).decode("utf-8", errors="replace")


def ask_claude(diff: str, api_key: str) -> list[dict]:
    prompt = (
        "You are a senior code reviewer. Given the following PR diff, provide at least "
        "2 review comments. If you find no issues, give positive, best-practice, or "
        "nitpick suggestions. Be actionable, constructive, and concise. "
        "Respond ONLY with a valid JSON array of objects with fields: "
        "file (string), line (number), comment (string). "
        "No text outside the JSON array.\n\nPR diff:\n" + diff
    )
    payload = {
        "model": "claude-sonnet-4-5",
        "max_tokens": 2048,
        "system": (
            "You are a precise and helpful code review assistant. "
            "Respond with clean, correct JSON only."
        ),
        "messages": [{"role": "user", "content": prompt}],
    }
    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }
    data = json.dumps(payload).encode()
    req  = urllib.request.Request(ANTHROPIC_API, data=data, headers=headers, method="POST")
    with urllib.request.urlopen(req) as resp:
        body = json.loads(resp.read())

    text = body.get("content", [{}])[0].get("text", "")
    if not text:
        print("Claude returned an empty response.", file=sys.stderr)
        return []

    start = text.find("[")
    end   = text.rfind("]") + 1
    if start == -1 or end == 0:
        print(f"No JSON array in Claude response:\n{text[:500]}", file=sys.stderr)
        return []

    return json.loads(text[start:end])


def post_inline_comment(repo: str, pr_number: str, head_sha: str,
                         token: str, suggestion: dict) -> bool:
    """Try to post a line-level review comment; fall back to issue comment."""
    gh_headers = {
        "Authorization": f"token {token}",
        "Content-Type": "application/json",
        "Accept": "application/vnd.github.v3+json",
    }

    inline_url  = f"{GITHUB_API}/repos/{repo}/pulls/{pr_number}/comments"
    fallback_url = f"{GITHUB_API}/repos/{repo}/issues/{pr_number}/comments"

    inline_payload = {
        "body":      suggestion.get("comment", ""),
        "commit_id": head_sha,
        "path":      suggestion.get("file", ""),
        "line":      suggestion.get("line", 1),
        "side":      "RIGHT",
    }
    try:
        data = json.dumps(inline_payload).encode()
        req  = urllib.request.Request(inline_url, data=data, headers=gh_headers, method="POST")
        with urllib.request.urlopen(req):
            return True
    except urllib.error.HTTPError:
        pass

    # Fallback: general issue comment
    fb_body = (
        f"**`{suggestion.get('file', '')}:{suggestion.get('line', '')}`** — "
        f"{suggestion.get('comment', '')}"
    )
    fb_data = json.dumps({"body": fb_body}).encode()
    fb_req  = urllib.request.Request(fallback_url, data=fb_data, headers=gh_headers, method="POST")
    try:
        with urllib.request.urlopen(fb_req):
            return True
    except urllib.error.HTTPError as e:
        print(f"Failed to post fallback comment: {e}", file=sys.stderr)
        return False


def main() -> None:
    token     = get_env("GITHUB_TOKEN")
    api_key   = get_env("ANTHROPIC_API_KEY")
    repo      = get_env("REPO")
    pr_number = get_env("PR_NUMBER")
    head_sha  = get_env("HEAD_SHA")

    print(f"Fetching diff for {repo}#{pr_number} …")
    diff = fetch_diff(repo, pr_number, token)
    if not diff.strip():
        print("Empty diff — nothing to review.")
        return

    diff_truncated = diff[:MAX_DIFF_CHARS]
    if len(diff) > MAX_DIFF_CHARS:
        print(f"Diff truncated from {len(diff)} to {MAX_DIFF_CHARS} characters.")

    print("Sending diff to Claude …")
    suggestions = ask_claude(diff_truncated, api_key)
    if not suggestions:
        print("No suggestions returned.")
        return

    print(f"Posting {min(len(suggestions), MAX_COMMENTS)} comments …")
    posted = 0
    for s in suggestions[:MAX_COMMENTS]:
        if post_inline_comment(repo, pr_number, head_sha, token, s):
            posted += 1

    print(f"Done — posted {posted}/{len(suggestions[:MAX_COMMENTS])} comment(s).")


if __name__ == "__main__":
    main()
