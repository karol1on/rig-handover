import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RunStatus } from './types.js';
import { parseLine } from './read.js';

export type Counts = Record<RunStatus, number>;

// Lines per status in the night's log; unreadable file or bad lines count as nothing.
export function statusCounts(runsDir: string, night: string): Counts {
  const counts: Counts = { ok: 0, retry: 0, fail: 0 };
  let text = '';
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch {
    return counts;
  }
  for (const line of text.split('\n')) {
    const r = parseLine(line);
    if (r) counts[r.status]++;
  }
  return counts;
}
