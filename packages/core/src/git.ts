import { execSync } from 'child_process';
import * as path from 'path';

export interface BlameInfo {
  commitHash: string;
  authorTime: number;
  daysAgo: number;
  author: string;
  summary: string;
}

export function getLineBlame(filePath: string, line: number): BlameInfo | null {
  try {
    const dir = path.dirname(filePath);
    const out = execSync(
      `git blame --porcelain -L ${line},${line} "${filePath}"`,
      { cwd: dir, stdio: ['pipe', 'pipe', 'pipe'], timeout: 5000 },
    ).toString();

    const hashMatch = /^([0-9a-f]{40})/.exec(out);
    const timeMatch = /^author-time (\d+)/m.exec(out);
    const authorMatch = /^author (.+)/m.exec(out);
    const summaryMatch = /^summary (.+)/m.exec(out);

    if (!hashMatch || !timeMatch) return null;

    const authorTime = parseInt(timeMatch[1], 10);
    const daysAgo = Math.floor((Date.now() / 1000 - authorTime) / 86400);

    return {
      commitHash: hashMatch[1],
      authorTime,
      daysAgo,
      author: authorMatch?.[1]?.trim() ?? 'Unknown',
      summary: summaryMatch?.[1]?.trim() ?? '',
    };
  } catch {
    return null;
  }
}

export function parseDuration(s: string): { days?: number; commits?: number } | null {
  const commitMatch = /^(\d+)commits?$/.exec(s);
  if (commitMatch) return { commits: parseInt(commitMatch[1], 10) };

  const dayMatch = /^(\d+)d$/.exec(s);
  if (dayMatch) return { days: parseInt(dayMatch[1], 10) };

  const weekMatch = /^(\d+)w$/.exec(s);
  if (weekMatch) return { days: parseInt(weekMatch[1], 10) * 7 };

  const monthMatch = /^(\d+)m$/.exec(s);
  if (monthMatch) return { days: parseInt(monthMatch[1], 10) * 30 };

  return null;
}

export function getCommitDateNAgo(filePath: string, n: number): number | null {
  try {
    const dir = path.dirname(filePath);
    const out = execSync(
      `git log --format="%ct" -${n} -- "${filePath}"`,
      { cwd: dir, stdio: ['pipe', 'pipe', 'pipe'], timeout: 5000 },
    ).toString().trim();

    const lines = out.split('\n').filter(Boolean);
    if (lines.length < n) return null;

    return parseInt(lines[lines.length - 1], 10);
  } catch {
    return null;
  }
}

export function isInGitRepo(dir: string): boolean {
  try {
    execSync('git rev-parse --git-dir', { cwd: dir, stdio: 'pipe', timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}
