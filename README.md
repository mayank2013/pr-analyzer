# PR Analyzer

An AI-powered PR review tool built with Next.js. Analyzes GitHub pull request diffs using Claude and either posts comments through the web UI or automatically via a GitHub Action.

## Features

- Fetch and analyze any GitHub (github.com or GitHub Enterprise) PR
- AI review powered by **Claude** (Anthropic API)
- Select specific files to review (up to 5 at a time)
- Choose and post inline review comments directly to the PR
- **GitHub Action** for fully automated reviews on every PR

---

## Option A — Web App

### 1. Get an Anthropic API key

Sign up at [console.anthropic.com](https://console.anthropic.com/settings/keys) and create an API key.

### 2. Clone and configure

```sh
git clone https://github.com/your-username/pr-analyzer.git
cd pr-analyzer
npm install
cp .env.example .env.local
# Edit .env.local and set ANTHROPIC_API_KEY=sk-ant-...
```

### 3. Run locally

```sh
npm run dev
# Open http://localhost:3000
```

### 4. Deploy to Vercel (one-click)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-username/pr-analyzer&env=ANTHROPIC_API_KEY&envDescription=Your%20Anthropic%20API%20key&envLink=https://console.anthropic.com/settings/keys)

> Set `ANTHROPIC_API_KEY` in Vercel → Project → Settings → Environment Variables.

### Using the web app

1. Paste a GitHub PR URL (e.g. `https://github.com/owner/repo/pull/123`)
2. Paste your **GitHub personal access token** — needs `repo` scope ([generate one here](https://github.com/settings/tokens/new?scopes=repo&description=PR+Analyzer))
3. Click **Analyze PR** → select files → click **Analyze & Suggest Comments**
4. Pick the comments you want and click **Post Selected Comments**

---

## Option B — GitHub Action (automated reviews on every PR)

Add this to any repository and Claude will automatically comment on every new PR.

### 1. Copy the workflow files

Copy `.github/workflows/pr-review.yml` and `.github/scripts/review.py` from this repo into the target repository, keeping the same folder structure.

### 2. Add your Anthropic API key as a secret

In the target repo: **Settings → Secrets and variables → Actions → New repository secret**

| Name | Value |
|---|---|
| `ANTHROPIC_API_KEY` | `sk-ant-...` |

`GITHUB_TOKEN` is provided automatically — no extra setup needed.

### 3. Open a PR

Claude will post inline review comments within a few seconds of the PR being opened or updated.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key from [console.anthropic.com](https://console.anthropic.com/settings/keys) |

---

## Tech Stack

- **Next.js 14** (React, TypeScript, App Router)
- **Tailwind CSS**
- **Anthropic Claude** (`claude-sonnet-4-5`)
- GitHub REST API v3
