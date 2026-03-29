"use client";
import dynamic from "next/dynamic";
import React, { useState } from "react";

const PRInputForm = dynamic(() => import("./components/PRInputForm"), { ssr: false });
const AnalysisResults = dynamic(() => import("./components/AnalysisResults"), { ssr: false });

function groupByFile(suggestions) {
  const grouped = {};
  for (const s of suggestions) {
    if (!grouped[s.file]) grouped[s.file] = [];
    grouped[s.file].push(s);
  }
  return grouped;
}

export default function HomePage() {
  const [modifiedFiles, setModifiedFiles] = useState<any[]>([]); // [{file, diff}]
  const [selectedFiles, setSelectedFiles] = useState<Set<number>>(new Set());
  const [fileSuggestions, setFileSuggestions] = useState<{[file: string]: any[]}>({});
  const [selectedComments, setSelectedComments] = useState<{[file: string]: Set<number>}>({});
  const [prUrl, setPrUrl] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [prDetails, setPrDetails] = useState<any>(null);
  const [useAI, setUseAI] = useState(true);

  // Fetch PR details and diffs, and extract modified files
  async function handleAnalyze(prUrl: string, token: string) {
    setPrUrl(prUrl);
    setToken(token);
    setLoading(true);
    setStatus("");
    setPrDetails(null);
    setModifiedFiles([]);
    setFileSuggestions({});
    setSelectedFiles(new Set());
    setSelectedComments({});
    // Store token
    await fetch("/api/auth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    // Fetch PR details and diff
    const prRes = await fetch("/api/pr/fetch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prUrl, token }),
    });
    const prData = await prRes.json();
    setPrDetails(prData.details);
    // Parse the diff into file diffs
    const fileDiffs = [];
    const diff = prData.diff || "";
    console.log("RAW DIFF:", diff); // Debug log
    const fileDiffBlocks = diff.split(/^diff --git /gm).filter(Boolean);
    for (const block of fileDiffBlocks) {
      const fileMatch = block.match(/^a\/(.+?) b\//m);
      const file = fileMatch ? fileMatch[1] : 'unknown';
      fileDiffs.push({ file, diff: 'diff --git ' + block });
    }
    setModifiedFiles(fileDiffs);
    setLoading(false);
  }

  // Handle file selection (max 5)
  function handleFileSelect(idx: number) {
    setSelectedFiles(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else if (next.size < 5) next.add(idx);
      return next;
    });
  }

  // Fetch comments for selected files
  async function fetchCommentsForSelectedFiles() {
    setLoading(true);
    setStatus("");
    const filesToAnalyze = Array.from(selectedFiles).map(idx => modifiedFiles[idx]);
    try {
      const res = await fetch("/api/pr/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileDiffs: filesToAnalyze, useAI }),
      });
      if (!res.ok) {
        setStatus(`Analysis request failed (HTTP ${res.status}). Check server logs.`);
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (data.error) {
        setStatus(`AI review error: ${data.error}`);
      }
      const grouped = groupByFile(data.suggestions || []);
      setFileSuggestions(grouped);
      const sel: {[file: string]: Set<number>} = {};
      for (const file of Object.keys(grouped)) sel[file] = new Set();
      setSelectedComments(sel);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatus(`Failed to analyze PR: ${msg}`);
    }
    setLoading(false);
  }

  // Handle comment selection per file
  function handleCommentToggle(file: string, idx: number) {
    setSelectedComments(prev => {
      // Always create a new Set instance for this file
      const next = { ...prev, [file]: new Set(prev[file] || []) };
      if (next[file].has(idx)) {
        next[file].delete(idx);
        console.log(`Deselected comment ${idx} for file ${file}`);
      } else {
        next[file].add(idx);
        console.log(`Selected comment ${idx} for file ${file}`);
      }
      // Debug log: print the updated selectedComments state for this file
      console.log('selectedComments for', file, ':', Array.from(next[file]));
      return next;
    });
  }

  // Post selected comments for all files
  async function handlePost() {
    setLoading(true);
    setStatus("");
    const comments = Object.entries(fileSuggestions).flatMap(([file, suggestions]) =>
      Array.from(selectedComments[file] || []).map(idx => suggestions[idx])
    );
    console.log('POSTING COMMENTS PAYLOAD:', comments); // Debug log
    const res = await fetch("/api/pr/comment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prUrl, token, comments }),
    });
    const data = await res.json();
    if (data.error) {
      setStatus(`Failed to post comments: ${data.error}`);
    } else if (data.posted > 0) {
      const msg = `Posted ${data.posted} of ${data.total} comments!`;
      setStatus(data.errors?.length ? `${msg}\nFailed: ${data.errors.join('\n')}` : msg);
    } else {
      setStatus(`Failed to post comments.${data.errors?.length ? '\n' + data.errors.join('\n') : ''}`);
    }
    setLoading(false);
  }

  return (
    <main className="max-w-2xl mx-auto py-10">
      <h1 className="text-2xl font-bold mb-6">PR Analyzer</h1>
      <div className="mb-4 flex items-center gap-2">
        <label className="font-semibold text-sm">
          <input
            type="checkbox"
            checked={useAI}
            onChange={e => setUseAI(e.target.checked)}
            className="mr-2"
          />
          Enable AI-powered review (Claude)
        </label>
      </div>
      <PRInputForm onSubmit={handleAnalyze} />
      {loading && <div className="mt-4 text-blue-600">Loading...</div>}
      {prDetails && (
        <div className="mt-6 p-4 border rounded bg-gray-50">
          <h2 className="font-semibold text-lg mb-2">PR Details</h2>
          <div className="text-sm text-gray-800">
            <div><span className="font-semibold">Title:</span> {prDetails.title}</div>
            <div><span className="font-semibold">Author:</span> {prDetails.user?.login}</div>
            <div><span className="font-semibold">State:</span> {prDetails.state}</div>
            <div><span className="font-semibold">Created:</span> {prDetails.created_at?.slice(0, 10)}</div>
            <div><span className="font-semibold">Branch:</span> {prDetails.head?.ref}</div>
            <div><span className="font-semibold">Base:</span> {prDetails.base?.ref}</div>
            <div className="mt-2"><span className="font-semibold">Description:</span> <span className="whitespace-pre-line">{prDetails.body || <span className="italic text-gray-500">No description</span>}</span></div>
          </div>
        </div>
      )}
      {modifiedFiles.length > 0 && (
        <div className="mt-6 p-4 border rounded bg-blue-50">
          <h2 className="font-semibold mb-2">Modified Files</h2>
          <div className="flex flex-col gap-2">
            {modifiedFiles.map((f, idx) => (
              <label
                key={f.file}
                className={`flex items-center gap-2 ${selectedFiles.has(idx) ? 'font-bold' : ''}`}
                style={{
                  wordBreak: 'break-all',
                  whiteSpace: 'normal',
                  maxWidth: '100%',
                  display: 'block',
                  padding: '2px 0',
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedFiles.has(idx)}
                  onChange={() => handleFileSelect(idx)}
                  disabled={!selectedFiles.has(idx) && selectedFiles.size >= 5}
                />
                <span
                  style={{
                    fontFamily: 'monospace',
                    wordBreak: 'break-all',
                    whiteSpace: 'normal',
                    maxWidth: 480,
                    display: 'inline-block',
                    verticalAlign: 'middle',
                  }}
                  title={f.file}
                >
                  {f.file}
                </span>
              </label>
            ))}
          </div>
          <button
            className="mt-4 bg-salesforce-blue text-white px-4 py-2 rounded hover:bg-salesforce-hover disabled:opacity-50"
            onClick={fetchCommentsForSelectedFiles}
            disabled={selectedFiles.size === 0 || loading}
          >
            Analyze & Suggest Comments for Selected Files
          </button>
        </div>
      )}
      {/* Display comments grouped by file */}
      {Object.entries(fileSuggestions).map(([file, suggestions]) => (
        <div key={file} className="mt-6 p-4 border rounded bg-gray-50">
          <h3 className="font-semibold mb-2">Comments for {file}</h3>
          <ul className="space-y-2">
            {suggestions.map((s, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={selectedComments[file]?.has(idx) || false}
                  onChange={() => handleCommentToggle(file, idx)}
                />
                <div>
                  <div className="text-sm text-gray-700">
                    <span className="font-mono bg-gray-200 px-1 rounded mr-2">
                      {s.file ? `${s.file}:${s.line}` : `Line ${s.line}`}
                    </span>
                    {s.comment}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {Object.keys(fileSuggestions).length > 0 && (
        <button
          className="mt-6 bg-lightning-yellow text-black px-4 py-2 rounded font-semibold hover:bg-yellow-300"
          onClick={handlePost}
          disabled={Object.values(selectedComments).every(set => set.size === 0) || loading}
        >
          Post Selected Comments
        </button>
      )}
      {status && (
        <div className={`mt-4 font-semibold whitespace-pre-line ${status.startsWith('Posted') ? 'text-green-700' : 'text-red-600'}`}>
          {status}
        </div>
      )}
    </main>
  );
}
