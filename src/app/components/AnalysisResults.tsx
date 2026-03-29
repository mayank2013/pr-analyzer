"use client";
import React from "react";

type Suggestion = {
  file: string;
  line: number;
  comment: string;
};

type Props = {
  suggestions: Suggestion[];
  selected: Set<number>;
  onToggle: (idx: number) => void;
  onPost: () => void;
};

export default function AnalysisResults({ suggestions, selected, onToggle, onPost }: Props) {
  if (!suggestions || suggestions.length === 0) return null;
  return (
    <div className="mt-6 p-4 border rounded bg-gray-50">
      <h2 className="font-bold mb-2">Suggested Comments</h2>
      <ul className="space-y-2">
        {suggestions.map((s, idx) => (
          <li key={idx} className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={selected.has(idx)}
              onChange={() => onToggle(idx)}
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
      <button
        className="mt-4 bg-lightning-yellow text-black px-4 py-2 rounded font-semibold hover:bg-yellow-300"
        onClick={onPost}
        disabled={selected.size === 0}
      >
        Post Selected Comments
      </button>
    </div>
  );
} 