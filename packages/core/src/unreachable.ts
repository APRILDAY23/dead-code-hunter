import * as fs from 'fs';
import * as path from 'path';
import fg from 'fast-glob';

export interface UnreachableCode {
  file: string;
  terminatorLine: number;
  terminatorText: string;
  unreachableLine: number;
  unreachableText: string;
}

export interface UnreachableResult {
  scannedFiles: number;
  unreachableCode: UnreachableCode[];
  durationMs: number;
}

const IGNORE = ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**', '**/vendor/**'];
const SOURCE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.py', '.go', '.java', '.rb', '.rs', '.php', '.cs']);

// Matches a line that unconditionally exits the current block
const TERMINATOR_RE = /^\s*(?:return|throw new |throw [A-Za-z]|raise |panic\(|exit\(|process\.exit\(|os\.Exit\(|sys\.exit\()\S*/;

// Matches a closing delimiter or blank - these are OK to appear after return
const CLOSING_RE = /^\s*(?:[}\])]|end\b|else\b|elif\b|rescue\b|catch\b|finally\b|except\b|case\b|default\b)\s*[{;]?\s*$/;

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

      // Skip comments and blank lines
      if (/^\s*(?:\/\/|#|\*|\/\*)/.test(line)) continue;
      if (/^\s*$/.test(line)) continue;
      if (!TERMINATOR_RE.test(line)) continue;

      // Find next non-blank line
      let j = i + 1;
      while (j < lines.length && /^\s*$/.test(lines[j])) j++;
      if (j >= lines.length) continue;

      const nextLine = lines[j];

      // If next non-blank line is a closing brace/keyword or comment, it's fine
      if (CLOSING_RE.test(nextLine)) continue;
      if (/^\s*(?:\/\/|#|\*)/.test(nextLine)) continue;

      // Check indentation - unreachable code should be at same or deeper indent
      const termIndent = line.match(/^(\s*)/)?.[1].length ?? 0;
      const nextIndent = nextLine.match(/^(\s*)/)?.[1].length ?? 0;
      if (nextIndent < termIndent) continue;

      unreachableCode.push({
        file,
        terminatorLine: i + 1,
        terminatorText: line.trim(),
        unreachableLine: j + 1,
        unreachableText: nextLine.trim(),
      });

      i = j; // skip ahead to avoid cascading reports
    }
  }

  return { scannedFiles: sourceFiles.length, unreachableCode, durationMs: Date.now() - start };
}
