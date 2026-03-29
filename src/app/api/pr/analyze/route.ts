import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const CHUNK_SIZE = 8000; // characters, safe for LLM context
const LINES_PER_CHUNK = 200;

type AISuggestion = { file: string; line: number; comment: string };
type AIResult = { suggestions: AISuggestion[]; error?: string };

async function getAISuggestions(diff: string): Promise<AIResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { suggestions: [], error: 'AI review is misconfigured: ANTHROPIC_API_KEY is not set on the server.' };
  }
  const prompt = `You are a senior code reviewer. Given the following PR diff, provide at least 2 review comments. If you find no issues, give positive, best-practice, or nitpick suggestions. Comments should be actionable, constructive, and concise. Respond ONLY with a valid JSON array of objects with fields: file (string), line (number), comment (string). No explanation outside the JSON array.\n\nPR diff:\n${diff}`;

  let response: Response;
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 2048,
        system: 'You are a precise and helpful code review assistant. Respond with clean, correct JSON only.',
        messages: [
          { role: 'user', content: prompt },
        ],
      }),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { suggestions: [], error: `Failed to reach Anthropic API: ${msg}` };
  }

  if (!response.ok) {
    let body = '';
    try { body = await response.text(); } catch {}
    return { suggestions: [], error: `Anthropic API error (HTTP ${response.status}): ${body || response.statusText}` };
  }

  const data = await response.json();
  // Anthropic returns: { content: [{ type: 'text', text: '...' }] }
  const text: string = data?.content?.[0]?.text || '';

  if (!text) {
    return { suggestions: [], error: 'AI returned an empty response.' };
  }

  try {
    const jsonStart = text.indexOf('[');
    const jsonEnd = text.lastIndexOf(']') + 1;
    if (jsonStart !== -1 && jsonEnd > jsonStart) {
      return { suggestions: JSON.parse(text.slice(jsonStart, jsonEnd)) };
    }
  } catch {
    // primary parse failed, try heuristic fallback
  }

  const match = text.match(/\[[\s\S]*\]/);
  if (match) {
    try {
      return { suggestions: JSON.parse(match[0]) };
    } catch {}
  }

  console.error('Could not parse Claude response as JSON:', text);
  return { suggestions: [], error: 'AI response could not be parsed.' };
}

function staticSuggestions(diff: string) {
  if (!diff) return [];
  if (diff.length > 1000) {
    return [{ file: 'unknown', line: 1, comment: 'Large PR detected. Consider breaking it into smaller, focused changes for easier review.' }];
  }
  return [];
}

// Split a large diff by lines (preserving context)
function splitDiffByLines(diff: string, maxLines: number): string[] {
  const lines = diff.split('\n');
  const chunks = [];
  for (let i = 0; i < lines.length; i += maxLines) {
    const chunkLines = lines.slice(i, i + maxLines);
    chunks.push(chunkLines.join('\n'));
  }
  return chunks;
}

export async function POST(req: NextRequest) {
  const { fileDiffs, useAI } = await req.json();
  const suggestions: AISuggestion[] = [];
  const errors: string[] = [];

  if (useAI && Array.isArray(fileDiffs)) {
    for (const { file, diff } of fileDiffs) {
      console.log('ANALYZING FILE:', file, 'DIFF LENGTH:', diff.length);
      if (diff.length < CHUNK_SIZE) {
        const result = await getAISuggestions(diff);
        suggestions.push(...result.suggestions);
        if (result.error) errors.push(`${file}: ${result.error}`);
      } else {
        const lineChunks = splitDiffByLines(diff, LINES_PER_CHUNK);
        let foundChunk = false;
        for (const chunk of lineChunks) {
          if (chunk.length < CHUNK_SIZE) {
            foundChunk = true;
            const result = await getAISuggestions(chunk);
            suggestions.push(...result.suggestions);
            if (result.error) errors.push(`${file} (chunk): ${result.error}`);
          }
        }
        if (!foundChunk) {
          suggestions.push({ file, line: 1, comment: 'File diff too large for AI review, even by lines. Please review manually or split changes.' });
        }
      }
    }
  } else if (Array.isArray(fileDiffs)) {
    for (const { file, diff } of fileDiffs) {
      suggestions.push(...staticSuggestions(diff));
    }
  }

  return NextResponse.json({
    suggestions,
    ...(errors.length > 0 && { error: errors.join('\n') }),
  });
} 