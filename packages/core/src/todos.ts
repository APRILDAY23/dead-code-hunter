import * as fs from 'fs';
import * as path from 'path';
import fg from 'fast-glob';
import { getLineBlame, isInGitRepo } from './git';

export interface TodoItem {
  file: string;
  line: number;
  kind: 'TODO' | 'FIXME' | 'HACK' | 'XXX' | 'BUG' | 'TEMP' | 'DEPRECATED';
  text: string;
  daysSince?: number;
  commitHash?: string;
}

export interface TodosResult {
  scannedFiles: number;
  todos: TodoItem[];
  durationMs: number;
}

const TODO_RE = /(?:\/\/|#|--|\/\*)\s*(TODO|FIXME|HACK|XXX|BUG|TEMP|DEPRECATED)\b[\s:]*([^*\n]*)/i;
const IGNORE = ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**', '**/vendor/**'];
const SOURCE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.py', '.go', '.java', '.rb', '.rs', '.php', '.cs']);

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
      const item: TodoItem = {
        file,
        line: lineNum,
        kind: m[1].toUpperCase() as TodoItem['kind'],
        text: m[2].trim(),
      };

      if (gitEnabled) {
        const blame = getLineBlame(file, lineNum);
        if (blame) {
          item.daysSince = blame.daysAgo;
          item.commitHash = blame.commitHash.slice(0, 7);
        }
      }

      if (olderThanDays !== undefined && item.daysSince !== undefined && item.daysSince < olderThanDays) continue;

      todos.push(item);
    }
  }

  todos.sort((a, b) => (b.daysSince ?? 0) - (a.daysSince ?? 0));

  return { scannedFiles: sourceFiles.length, todos, durationMs: Date.now() - start };
}
