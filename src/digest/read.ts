import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, ReadNight, RunLine, RunStatus } from './types.js';

const isStatus = (v: unknown): v is RunStatus => v === 'ok' || v === 'retry' || v === 'fail';

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export function parseLine(line: string): RunLine | null {
  let v: unknown;
  try {
    v = JSON.parse(line);
  } catch {
    return null;
  }
  if (!isObject(v)) return null;
  const { at, job, status, owner, error } = v;
  if (typeof at !== 'string' || Number.isNaN(Date.parse(at))) return null;
  if (typeof job !== 'string' || job === '') return null;
  if (!isStatus(status)) return null;
  if (owner !== null && typeof owner !== 'string') return null;
  if (error !== undefined && error !== null && typeof error !== 'string') return null;
  return { at, job, status, owner, error: error ?? null };
}

export const readNight: ReadNight = (runsDir, night) => {
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch (e) {
    if (isObject(e) && e.code === 'ENOENT') return null;
    throw e;
  }

  let badLines = 0;
  const byJob = new Map<string, RunLine[]>();
  for (const raw of text.split('\n')) {
    if (raw.trim() === '') continue;
    const line = parseLine(raw);
    if (!line) {
      badLines++;
      continue;
    }
    byJob.set(line.job, [...(byJob.get(line.job) ?? []), line]);
  }

  const rows: DigestRow[] = [...byJob.entries()].map(([job, lines]) => {
    // Compare instants (offsets may differ), but output `at` as written. Stable sort keeps file order on ties.
    const sorted = lines.toSorted((a, b) => Date.parse(a.at) - Date.parse(b.at));
    const first = sorted[0]!;
    const last = sorted[sorted.length - 1]!;
    return {
      job,
      owner: last.owner,
      runs: lines.length,
      retries: lines.filter((l) => l.status === 'retry').length,
      lastStatus: last.status,
      lastError: last.error,
      firstAt: first.at,
      lastAt: last.at,
    };
  });
  rows.sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));
  return { rows, badLines };
};
