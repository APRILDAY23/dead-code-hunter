import * as fs from 'fs';
import * as path from 'path';
import fg from 'fast-glob';
import { getLineBlame, isInGitRepo } from './git';

export type TodoKind = 'TODO' | 'FIXME' | 'HACK' | 'XXX' | 'BUG' | 'TEMP' | 'DEPRECATED';

export interface TodoItem {
  file: string;
  line: number;
  kind: TodoKind;
  text: string;
  context: string[]; // surrounding lines for context
  daysSince?: number;
  author?: string;
  commitHash?: string;
  issueRef?: string; // e.g. "#123" or "JIRA-456"
}

export interface TodosResult {
  scannedFiles: number;
  todos: TodoItem[];
  byKind: Record<TodoKind, number>;
  byAuthor: Record<string, number>;
  durationMs: number;
}

const TODO_RE = /(?:\/\/|#|--|\/\*)\s*(TODO|FIXME|HACK|XXX|BUG|TEMP|DEPRECATED)\b[\s:]*([^*\n]*)/i;
const ISSUE_RE = /(?:#(\d+)|([A-Z]+-\d+))/;
const IGNORE = ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**', '**/vendor/**'];
const SOURCE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.py', '.go', '.java', '.rb', '.rs', '.php', '.cs']);

const SEVERITY: Record<string, number> = { DEPRECATED: 5, BUG: 4, FIXME: 3, HACK: 2, TODO: 1, XXX: 1, TEMP: 1 };

export async function analyzeTodos(rootDir: string, olderThanDays?: number): Promise<TodosResult> {
  const start = Date.now();
  const todos: TodoItem[] = [];
  const gitEnabled = isInGitRepo(rootDir);

  const files = await fg('**/*', { cwd: rootDir, absolute: true, onlyFiles: true, ignore: IGNORE });
  const sourceFiles = files.filter(f => SOURCE_EXTS.has(path.extname(f).toLowerCase()));

  for (const file of sourceFiles) {
    let content: string;
    try { content = fs.readFileSync(file, 'utf-8'); } catch { continue; }

    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const m = TODO_RE.exec(lines[i]);
      if (!m) continue;

      const lineNum = i + 1;
      const text = m[2].trim();
      const issueMatch = ISSUE_RE.exec(text);

      const item: TodoItem = {
        file,
        line: lineNum,
        kind: m[1].toUpperCase() as TodoKind,
        text,
        context: lines.slice(Math.max(0, i - 1), Math.min(lines.length, i + 3)),
        issueRef: issueMatch ? (issueMatch[1] ? `#${issueMatch[1]}` : issueMatch[2]) : undefined,
      };

      if (gitEnabled) {
        const blame = getLineBlame(file, lineNum);
        if (blame) {
          item.daysSince = blame.daysAgo;
          item.commitHash = blame.commitHash.slice(0, 7);
          item.author = blame.author;
        }
      }

      if (olderThanDays !== undefined && item.daysSince !== undefined && item.daysSince < olderThanDays) continue;

      todos.push(item);
    }
  }

  // Sort: severity desc, then age desc
  todos.sort((a, b) => {
    const sv = (SEVERITY[b.kind] ?? 0) - (SEVERITY[a.kind] ?? 0);
    if (sv !== 0) return sv;
    return (b.daysSince ?? 0) - (a.daysSince ?? 0);
  });

  const byKind = {} as Record<TodoKind, number>;
  const byAuthor: Record<string, number> = {};
  for (const t of todos) {
    byKind[t.kind] = (byKind[t.kind] ?? 0) + 1;
    if (t.author) byAuthor[t.author] = (byAuthor[t.author] ?? 0) + 1;
  }

  return { scannedFiles: sourceFiles.length, todos, byKind, byAuthor, durationMs: Date.now() - start };
}
