"use client";
import React, { useState } from "react";

type Props = {
  onSubmit: (prUrl: string, token: string) => void;
};

export default function PRInputForm({ onSubmit }: Props) {
  const [prUrl, setPrUrl] = useState("");
  const [token, setToken] = useState("");

  return (
    <form
      className="flex flex-col gap-4 p-4 border rounded bg-white"
      onSubmit={e => {
        e.preventDefault();
        onSubmit(prUrl, token);
      }}
    >
      <label className="font-semibold">
        PR URL
        <input
          className="border p-2 rounded w-full mt-1 font-mono text-sm"
          type="text"
          placeholder="https://github.com/owner/repo/pull/123"
          value={prUrl}
          onChange={e => setPrUrl(e.target.value)}
          required
        />
      </label>
      <label className="font-semibold">
        GitHub Token
        <input
          className="border p-2 rounded w-full mt-1"
          type="password"
          placeholder="ghp_..."
          value={token}
          onChange={e => setToken(e.target.value)}
          required
        />
      </label>
      <div className="flex flex-col gap-1 text-sm text-gray-600">
        <div className="flex items-center gap-2">
          <a
            href="https://github.com/settings/tokens/new?scopes=repo&description=PR+Analyzer"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-700 underline hover:text-blue-900 font-medium"
          >
            Generate token on GitHub
          </a>
          <span>— needs <code className="bg-gray-100 px-1 rounded">repo</code> scope (or <code className="bg-gray-100 px-1 rounded">public_repo</code> for public repos).</span>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="font-mono bg-gray-100 px-2 py-1 rounded select-all text-xs">gh auth token</span>
          <span>— or run this to print your existing GitHub CLI token.</span>
        </div>
      </div>
      <button
        className="bg-salesforce-blue text-white px-4 py-2 rounded hover:bg-salesforce-hover"
        type="submit"
      >
        Analyze PR
      </button>
    </form>
  );
} 