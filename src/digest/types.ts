export type RunStatus = 'ok' | 'retry' | 'fail';

export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number;
  retries: number;
  lastStatus: RunStatus;
  lastError: string | null;
  firstAt: string;
  lastAt: string;
};

export type Night = { rows: DigestRow[]; badLines: number };

// null = no file for that night.
export type ReadNight = (runsDir: string, night: string) => Night | null;

// One parsed line of runs/<night>.jsonl.
export type RunLine = {
  at: string;
  job: string;
  status: RunStatus;
  owner: string | null;
  error: string | null;
};
