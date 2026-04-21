import * as fs from 'fs';
import * as path from 'path';
import fg from 'fast-glob';

export type UnreachableSeverity = 'error' | 'warning';

export interface UnreachableCode {
  file: string;
  terminatorLine: number;
  terminatorText: string;
  unreachableLine: number;
  unreachableEnd: number;
  unreachableLines: string[];
  severity: UnreachableSeverity;
}

export interface UnreachableResult {
  scannedFiles: number;
  unreachableCode: UnreachableCode[];
  durationMs: number;
}

const IGNORE = ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**', '**/vendor/**'];
const SOURCE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.py', '.go', '.java', '.rb', '.rs', '.php', '.cs']);

const TERMINATOR_RE = /^\s*(?:return\b|throw\b|throw new\b|raise\b|panic\s*\(|exit\s*\(|process\.exit\s*\(|os\.Exit\s*\(|sys\.exit\s*\(|abort\s*\()/;
const CLOSING_RE = /^\s*(?:[}\])]|end\b|else\b|elif\b|elsif\b|rescue\b|catch\b|finally\b|except\b|case\b|default\b|when\b|ensure\b)/;

function collectUnreachableBlock(lines: string[], fromIdx: number, termIndent: number): string[] {
  const block: string[] = [];
  for (let k = fromIdx; k < lines.length; k++) {
    const l = lines[k];
    if (/^\s*$/.test(l)) break;
    const ind = l.match(/^(\s*)/)?.[1].length ?? 0;
    if (ind < termIndent) break;
    if (CLOSING_RE.test(l)) break;
    block.push(l.trimEnd());
    if (block.length >= 10) { block.push('  ...'); break; } // cap preview
  }
  return block;
}

export async function analyzeUnreachable(rootDir: string): Promise<UnreachableResult> {
  const start = Date.now();
  const unreachableCode: UnreachableCode[] = [];

  const files = await fg('**/*', { cwd: rootDir, absolute: true, onlyFiles: true, ignore: IGNORE });
  const sourceFiles = files.filter(f => SOURCE_EXTS.has(path.extname(f).toLowerCase()));

  for (const file of sourceFiles) {
    let content: string;
    try { content = fs.readFileSync(file, 'utf-8'); } catch { continue; }

    const lines = content.split('\n');

    for (let i = 0; i < lines.length - 1; i++) {
      const line = lines[i];

      if (/^\s*(?:\/\/|#|\*|\/\*)/.test(line)) continue;
      if (/^\s*$/.test(line)) continue;
      if (!TERMINATOR_RE.test(line)) continue;

      const termIndent = line.match(/^(\s*)/)?.[1].length ?? 0;

      // Skip past blank lines
      let j = i + 1;
      while (j < lines.length && /^\s*$/.test(lines[j])) j++;
      if (j >= lines.length) continue;

      const nextLine = lines[j];
      if (CLOSING_RE.test(nextLine)) continue;
      if (/^\s*(?:\/\/|#|\*|\/\*)/.test(nextLine)) continue;

      const nextIndent = nextLine.match(/^(\s*)/)?.[1].length ?? 0;
      if (nextIndent < termIndent) continue;

      const unreachableLines = collectUnreachableBlock(lines, j, termIndent);
      if (unreachableLines.length === 0) continue;

      const isThrow = /throw|raise|panic/.test(line);
      unreachableCode.push({
        file,
        terminatorLine: i + 1,
        terminatorText: line.trim(),
        unreachableLine: j + 1,
        unreachableEnd: j + unreachableLines.length,
        unreachableLines,
        severity: isThrow ? 'error' : 'warning',
      });

      i = j + unreachableLines.length - 1;
    }
  }

  return { scannedFiles: sourceFiles.length, unreachableCode, durationMs: Date.now() - start };
}
