import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const line = (o: object) => JSON.stringify(o);
const ev = (at: string, job: string, status: string, extra = {}) => line({ at, job, status, owner: 'rook', ...extra });

const runsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rig-digest-'));
const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir };
const app = createApp(config);

beforeAll(() => {
  const t = (m: number) => `2026-10-28T23:0${m}:00+01:00`;
  const normal = [
    ev(t(1), 'zeta/job', 'ok'),
    ev(t(2), 'alpha/job', 'retry', { error: 'upstream 503' }),
    ev(t(3), 'alpha/job', 'retry', { error: 'upstream 503' }),
    ev(t(4), 'alpha/job', 'retry', { error: 'upstream 503' }),
    ev(t(5), 'alpha/job', 'ok'),
  ];
  fs.writeFileSync(path.join(runsDir, '2026-10-01.jsonl'), normal.join('\n') + '\n');
  fs.writeFileSync(path.join(runsDir, '2026-10-02.jsonl'), '');
  fs.writeFileSync(path.join(runsDir, '2026-10-03.jsonl'), [ev(t(1), 'alpha/job', 'ok'), 'not json'].join('\n') + '\n');
});

describe.each([
  ['/digest/', 'page'],
  ['/api/digest/', 'json'],
])('%s:night', (prefix, kind) => {
  const get = (night: string) => app.request(prefix + night);

  it('200 for a night with a file', async () => {
    expect((await get('2026-10-01')).status).toBe(200);
  });

  it.each(['2026-10-09', 'not-a-date', '2026-10-2'])('404 for %s', async (night) => {
    expect((await get(night)).status).toBe(404);
  });

  it('empty night', async () => {
    const res = await get('2026-10-02');
    expect(res.status).toBe(200);
    if (kind === 'json') expect(await res.json()).toMatchObject({ rows: [] });
    else expect(await res.text()).toContain('nothing ran');
  });

  it('bad line is counted, night still renders', async () => {
    const res = await get('2026-10-03');
    expect(res.status).toBe(200);
    if (kind === 'json') expect(await res.json()).toMatchObject({ badLines: 1 });
    else expect(await res.text()).toContain('1 line(s) skipped (did not parse)');
  });
});

it('page and JSON list the same jobs in the same order', async () => {
  const { rows } = (await (await app.request('/api/digest/2026-10-01')).json()) as { rows: { job: string }[] };
  const html = await (await app.request('/digest/2026-10-01')).text();
  const jobs = rows.map((r) => r.job);
  expect(jobs).toHaveLength(2);
  const pos = jobs.map((j) => html.indexOf(j));
  expect(pos.every((p) => p >= 0)).toBe(true);
  expect([...pos].sort((a, b) => a - b)).toEqual(pos);
});
