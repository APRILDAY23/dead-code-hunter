import * as fs from 'fs';
import * as path from 'path';
import fg from 'fast-glob';

export interface DuplicateOccurrence {
  file: string;
  startLine: number;
  endLine: number;
  name: string;
}

export interface DuplicateGroup {
  occurrences: DuplicateOccurrence[];
  lineCount: number;
  snippet: string;           // first 4 lines of the body for preview
  suggestedLocation: string; // common ancestor directory for extraction
}

export interface DupesResult {
  scannedFiles: number;
  duplicateGroups: DuplicateGroup[];
  totalWastedLines: number;
  durationMs: number;
}

const IGNORE = ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**', '**/vendor/**', '**/target/**'];
const SOURCE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.py', '.go', '.rs', '.java', '.rb', '.php', '.cs']);

function normalize(text: string): string {
  return text
    .replace(/\/\/.*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/#[^\n]*/g, '')
    .replace(/\b(?:const|let|var)\s+\w+/g, 'VAR _')
    .replace(/\b(?:function|def|func|fn|sub)\s+\w+/g, 'FN _')
    .replace(/"[^"]*"/g, '""')
    .replace(/'[^']*'/g, "''")
    .replace(/`[^`]*`/g, '``')
    .replace(/\b\d+(\.\d+)?\b/g, '0')
    .replace(/\s+/g, ' ')
    .trim();
}

function djb2(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 33) + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function commonAncestor(files: string[]): string {
  if (files.length === 0) return '';
  const parts = files.map(f => path.dirname(f).split(path.sep));
  const shortest = parts.reduce((a, b) => a.length <= b.length ? a : b);
  const common: string[] = [];
  for (let i = 0; i < shortest.length; i++) {
    if (parts.every(p => p[i] === shortest[i])) common.push(shortest[i]);
    else break;
  }
  return common.join(path.sep) || path.sep;
}

interface Block { name: string; start: number; end: number; body: string }

function bracketBlocks(lines: string[], nameRe: RegExp, skip: string[]): Block[] {
  const blocks: Block[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = nameRe.exec(lines[i]);
    if (!m) continue;
    const name = (m[1] || m[2] || m[3] || 'anon').trim();
    if (skip.includes(name)) continue;

    let depth = 0, started = false, end = i;
    for (let j = i; j < Math.min(i + 400, lines.length); j++) {
      for (const ch of lines[j]) {
        if (ch === '{') { depth++; started = true; }
        else if (ch === '}') depth--;
      }
      if (started && depth === 0) { end = j; break; }
    }
    if (end - i < 4) continue;
    blocks.push({ name, start: i + 1, end: end + 1, body: lines.slice(i, end + 1).join('\n') });
    i = end; // skip to end of block
  }
  return blocks;
}

function indentBlocks(lines: string[], defRe: RegExp): Block[] {
  const blocks: Block[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = defRe.exec(lines[i]);
    if (!m) continue;
    const indent = (lines[i].match(/^(\s*)/)?.[1].length ?? 0);
    const name = m[1] || m[2] || 'anon';
    let end = i + 1;
    while (end < lines.length && (lines[end].trim() === '' || (lines[end].match(/^(\s*)/)?.[1].length ?? 0) > indent)) end++;
    if (end - i < 4) continue;
    blocks.push({ name, start: i + 1, end, body: lines.slice(i, end).join('\n') });
    i = end - 1;
  }
  return blocks;
}

function extractBlocks(content: string, filePath: string): Block[] {
  const ext = path.extname(filePath).toLowerCase();
  const lines = content.split('\n');
  const CONTROL = ['if', 'for', 'while', 'switch', 'catch', 'else', 'try', 'with', 'do'];

  if (['.ts', '.tsx', '.js', '.jsx', '.mjs'].includes(ext)) {
    return bracketBlocks(lines,
      /(?:(?:async\s+)?function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(|^\s*(?:async\s+)?(\w+)\s*\()/,
      CONTROL,
    );
  }
  if (['.java', '.cs', '.php'].includes(ext)) {
    return bracketBlocks(lines,
      /(?:public|private|protected|static|async|override|virtual|\s)+[\w<>\[\]?]+\s+(\w+)\s*\(/,
      CONTROL,
    );
  }
  if (ext === '.go') {
    return bracketBlocks(lines,
      /^func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)\s*\(/,
      [],
    );
  }
  if (ext === '.rs') {
    return bracketBlocks(lines,
      /^\s*(?:pub(?:\s*\([^)]*\))?\s+)?(?:async\s+)?fn\s+(\w+)/,
      [],
    );
  }
  if (ext === '.py') {
    return indentBlocks(lines, /^(\s*)(?:async\s+)?def\s+(\w+)/);
  }
  if (ext === '.rb') {
    return indentBlocks(lines, /^\s*(?:def\s+(?:self\.)?(\w+)|class\s+(\w+))/);
  }
  return [];
}

export async function analyzeDupes(rootDir: string, minLines = 6): Promise<DupesResult> {
  const start = Date.now();
  const hashMap = new Map<string, Array<{ file: string; startLine: number; endLine: number; name: string; body: string }>>();

  const files = await fg('**/*', { cwd: rootDir, absolute: true, onlyFiles: true, ignore: IGNORE });
  const sourceFiles = files.filter(f => SOURCE_EXTS.has(path.extname(f).toLowerCase()));

  for (const file of sourceFiles) {
    let content: string;
    try { content = fs.readFileSync(file, 'utf-8'); } catch { continue; }

    for (const block of extractBlocks(content, file)) {
      if (block.end - block.start + 1 < minLines) continue;
      const norm = normalize(block.body);
      if (norm.length < 80) continue;
      const hash = djb2(norm);
      if (!hashMap.has(hash)) hashMap.set(hash, []);
      hashMap.get(hash)!.push({ file, startLine: block.start, endLine: block.end, name: block.name, body: block.body });
    }
  }

  const duplicateGroups: DuplicateGroup[] = [];
  let totalWastedLines = 0;

  for (const [, entries] of hashMap) {
    if (entries.length < 2) continue;
    const lineCount = entries[0].endLine - entries[0].startLine + 1;
    const snippet = entries[0].body
      .split('\n')
      .slice(0, 4)
      .map(l => l.trimEnd())
      .join('\n');
    const suggested = commonAncestor(entries.map(e => e.file));
    const occurrences = entries.map(({ file, startLine, endLine, name }) => ({ file, startLine, endLine, name }));
    totalWastedLines += lineCount * (entries.length - 1);
    duplicateGroups.push({ occurrences, lineCount, snippet, suggestedLocation: suggested });
  }

  duplicateGroups.sort((a, b) => b.lineCount - a.lineCount);

  return { scannedFiles: sourceFiles.length, duplicateGroups, totalWastedLines, durationMs: Date.now() - start };
}
