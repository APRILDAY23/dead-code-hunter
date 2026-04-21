import * as fs from 'fs';
import * as path from 'path';
import fg from 'fast-glob';

export interface EmptyCatch {
  file: string;
  line: number;
  snippet: string;
  kind: 'empty' | 'swallowed'; // empty = {}, swallowed = only has a comment or pass
}

export interface CatchesResult {
  scannedFiles: number;
  emptyCatches: EmptyCatch[];
  durationMs: number;
}

const IGNORE = ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**', '**/vendor/**'];
const SOURCE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.py', '.go', '.java', '.rb', '.rs', '.php', '.cs']);

function isCatchBodyEmpty(lines: string[], openLine: number): boolean {
  let depth = 0;
  let started = false;
  const bodyLines: string[] = [];

  for (let i = openLine; i < lines.length; i++) {
    for (const ch of lines[i]) {
      if (ch === '{') { depth++; started = true; }
      else if (ch === '}') depth--;
    }
    if (started) {
      if (depth > 0) bodyLines.push(lines[i]);
      if (depth === 0) break;
    }
  }

  return bodyLines.every(l => /^\s*(?:\/\/[^\n]*|\/\*[^*]*\*\/|#[^\n]*)?\s*$/.test(l));
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

      // JS / TS / Java / C# / PHP
      if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.java', '.cs', '.php'].includes(ext)) {
        if (!/\bcatch\b/.test(line)) continue;
        // Find the brace that opens the catch body
        let braceLineIdx = i;
        if (!line.includes('{')) {
          braceLineIdx = Math.min(i + 1, lines.length - 1);
        }
        if (isCatchBodyEmpty(lines, braceLineIdx)) {
          emptyCatches.push({ file, line: i + 1, snippet: line.trim(), kind: 'empty' });
        } else {
          // Check for swallowed: body only has `console.log` or similar
          const body: string[] = [];
          let depth = 0, started = false;
          for (let j = braceLineIdx; j < lines.length; j++) {
            for (const ch of lines[j]) {
              if (ch === '{') { depth++; started = true; }
              else if (ch === '}') depth--;
            }
            if (started && depth > 0) body.push(lines[j].trim());
            if (started && depth === 0) break;
          }
          const isSwallowed = body.length > 0 && body.every(l =>
            /^\s*$/.test(l) || /^\/\//.test(l) || /^console\.(log|warn|error|debug)/.test(l)
          );
          if (isSwallowed) {
            emptyCatches.push({ file, line: i + 1, snippet: line.trim(), kind: 'swallowed' });
          }
        }
      }

      // Python: except + pass
      else if (ext === '.py') {
        if (!/^\s*except\b/.test(line)) continue;
        let j = i + 1;
        while (j < lines.length && /^\s*$/.test(lines[j])) j++;
        if (j < lines.length && /^\s*pass\s*(?:#.*)?$/.test(lines[j])) {
          emptyCatches.push({ file, line: i + 1, snippet: line.trim(), kind: 'empty' });
        }
      }

      // Go: if err != nil { } (empty body)
      else if (ext === '.go') {
        if (!line.includes('err') || !line.includes('{')) continue;
        if (!/if\s+err\s*!=\s*nil/.test(line) && !line.includes('err != nil')) continue;
        const next = lines[i + 1] ?? '';
        if (/^\s*}\s*$/.test(next)) {
          emptyCatches.push({ file, line: i + 1, snippet: line.trim(), kind: 'empty' });
        }
      }

      // Ruby: rescue + nil/empty body
      else if (ext === '.rb') {
        if (!/^\s*rescue\b/.test(line)) continue;
        let j = i + 1;
        while (j < lines.length && /^\s*$/.test(lines[j])) j++;
        if (j < lines.length && /^\s*(?:end|nil|#.*)?\s*$/.test(lines[j])) {
          emptyCatches.push({ file, line: i + 1, snippet: line.trim(), kind: 'empty' });
        }
      }
    }
  }

  return { scannedFiles: sourceFiles.length, emptyCatches, durationMs: Date.now() - start };
}
