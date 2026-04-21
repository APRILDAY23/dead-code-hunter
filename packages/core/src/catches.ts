import * as fs from 'fs';
import * as path from 'path';
import fg from 'fast-glob';

export type CatchSeverity = 'error' | 'warning' | 'info';

export interface EmptyCatch {
  file: string;
  line: number;
  snippet: string;
  kind: 'empty' | 'swallowed' | 'broad' | 'panic';
  severity: CatchSeverity;
  suggestion: string;
}

export interface CatchesResult {
  scannedFiles: number;
  emptyCatches: EmptyCatch[];
  bySeverity: Record<CatchSeverity, number>;
  durationMs: number;
}

const IGNORE = ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**', '**/vendor/**'];
const SOURCE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.py', '.go', '.java', '.rb', '.rs', '.php', '.cs']);

const BROAD_CATCH = /catch\s*\(\s*(?:e|err|error|ex|exception|_)\s*(?::\s*(?:any|Error|Exception|Throwable|\w+Error))?\s*\)/i;
const BROAD_PYTHON = /^\s*except\s*(?:Exception|BaseException)?\s*(?:as\s+\w+)?\s*:/;

function getCatchBody(lines: string[], openLine: number): string[] {
  const body: string[] = [];
  let depth = 0, started = false;
  for (let i = openLine; i < lines.length; i++) {
    for (const ch of lines[i]) {
      if (ch === '{') { depth++; started = true; }
      else if (ch === '}') depth--;
    }
    if (started) {
      if (depth > 0) body.push(lines[i].trim());
      if (depth === 0) break;
    }
  }
  return body;
}

function isBodyEmpty(body: string[]): boolean {
  return body.every(l => /^\s*(?:\/\/[^\n]*|\/\*[^*]*\*\/|#[^\n]*)?\s*$/.test(l));
}

function isBodySwallowed(body: string[]): boolean {
  const meaningful = body.filter(l => l.trim() && !/^\/\//.test(l.trim()));
  return meaningful.length > 0 && meaningful.every(l =>
    /^console\.(log|warn|error|debug|info)\s*\(/.test(l) ||
    /^print\s*\(/.test(l) ||
    /^logger\.(warn|info|debug|error)\s*\(/.test(l) ||
    /^log\.(Printf|Println|Print)\s*\(/.test(l),
  );
}

export async function analyzeCatches(rootDir: string): Promise<CatchesResult> {
  const start = Date.now();
  const emptyCatches: EmptyCatch[] = [];

  const files = await fg('**/*', { cwd: rootDir, absolute: true, onlyFiles: true, ignore: IGNORE });
  const sourceFiles = files.filter(f => SOURCE_EXTS.has(path.extname(f).toLowerCase()));

  for (const file of sourceFiles) {
    let content: string;
    try { content = fs.readFileSync(file, 'utf-8'); } catch { continue; }

    const ext = path.extname(file).toLowerCase();
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // --- JS / TS / Java / C# / PHP ---
      if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.java', '.cs', '.php'].includes(ext)) {
        if (!/\bcatch\b/.test(line)) continue;

        const braceLineIdx = line.includes('{') ? i : Math.min(i + 1, lines.length - 1);
        const body = getCatchBody(lines, braceLineIdx);

        if (isBodyEmpty(body)) {
          emptyCatches.push({
            file, line: i + 1, snippet: line.trim(),
            kind: 'empty', severity: 'error',
            suggestion: 'Log the error or re-throw it: throw err',
          });
        } else if (isBodySwallowed(body)) {
          emptyCatches.push({
            file, line: i + 1, snippet: line.trim(),
            kind: 'swallowed', severity: 'warning',
            suggestion: 'Consider re-throwing or returning a meaningful error',
          });
        } else if (BROAD_CATCH.test(line) && body.length > 0) {
          emptyCatches.push({
            file, line: i + 1, snippet: line.trim(),
            kind: 'broad', severity: 'info',
            suggestion: 'Catch a specific error type instead of a generic one',
          });
        }
      }

      // --- Python ---
      else if (ext === '.py') {
        if (!/^\s*except\b/.test(line)) continue;
        let j = i + 1;
        while (j < lines.length && /^\s*$/.test(lines[j])) j++;
        if (j < lines.length && /^\s*pass\s*(?:#.*)?$/.test(lines[j])) {
          emptyCatches.push({
            file, line: i + 1, snippet: line.trim(),
            kind: 'empty', severity: 'error',
            suggestion: 'Replace pass with logging or re-raise the exception',
          });
        } else if (BROAD_PYTHON.test(line)) {
          emptyCatches.push({
            file, line: i + 1, snippet: line.trim(),
            kind: 'broad', severity: 'info',
            suggestion: 'Catch a specific exception type',
          });
        }
      }

      // --- Go: blank if err != nil block ---
      else if (ext === '.go') {
        // Empty error check block
        if (/\bif\s+err\s*!=\s*nil\s*\{/.test(line)) {
          const next = lines[i + 1] ?? '';
          if (/^\s*}\s*$/.test(next)) {
            emptyCatches.push({
              file, line: i + 1, snippet: line.trim(),
              kind: 'empty', severity: 'error',
              suggestion: 'Handle the error: return err, log it, or wrap it',
            });
          }
        }
        // Discarded error: _ = someFunc()
        if (/(?:^|\s)_\s*(?:,\s*_\s*)*=/.test(line) && !/\/\//.test(line)) {
          emptyCatches.push({
            file, line: i + 1, snippet: line.trim(),
            kind: 'swallowed', severity: 'warning',
            suggestion: 'Assign the error to a named variable and check it',
          });
        }
      }

      // --- Rust: .unwrap() / .expect() without context ---
      else if (ext === '.rs') {
        if (!/\.(unwrap|expect)\s*\(/.test(line)) continue;
        if (/\/\/.*\.(unwrap|expect)/.test(line)) continue; // in comment
        // Allow in test files
        if (file.includes('test') || file.includes('spec')) continue;
        const isUnwrap = line.includes('.unwrap()');
        emptyCatches.push({
          file, line: i + 1, snippet: line.trim(),
          kind: 'panic', severity: isUnwrap ? 'warning' : 'info',
          suggestion: isUnwrap
            ? 'Replace .unwrap() with ? operator or match/if let'
            : 'Provide a more descriptive .expect() message or use ?',
        });
      }

      // --- Ruby: rescue with nil body ---
      else if (ext === '.rb') {
        if (!/^\s*rescue\b/.test(line)) continue;
        let j = i + 1;
        while (j < lines.length && /^\s*$/.test(lines[j])) j++;
        if (j < lines.length && /^\s*(?:end|nil|#.*)?\s*$/.test(lines[j])) {
          emptyCatches.push({
            file, line: i + 1, snippet: line.trim(),
            kind: 'empty', severity: 'error',
            suggestion: 'Log the exception ($!) or re-raise it',
          });
        }
      }
    }
  }

  const bySeverity: Record<CatchSeverity, number> = { error: 0, warning: 0, info: 0 };
  for (const c of emptyCatches) bySeverity[c.severity]++;

  return { scannedFiles: sourceFiles.length, emptyCatches, bySeverity, durationMs: Date.now() - start };
}
