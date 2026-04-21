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
  normalizedSize: number;
}

export interface DupesResult {
  scannedFiles: number;
  duplicateGroups: DuplicateGroup[];
  durationMs: number;
}

const IGNORE = ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**', '**/vendor/**', '**/target/**'];
const SOURCE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.py', '.go', '.rs', '.java']);

function normalize(text: string): string {
  return text
    .replace(/\/\/.*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/#[^\n]*/g, '')
    .replace(/\b(?:const|let|var)\s+\w+/g, 'var _')
    .replace(/\b(?:function|def|func|fn)\s+\w+/g, 'fn _')
    .replace(/"[^"]*"/g, '""')
    .replace(/'[^']*'/g, "''")
    .replace(/`[^`]*`/g, '``')
    .replace(/\b\d+\b/g, '0')
    .replace(/\s+/g, ' ')
    .trim();
}

function djb2(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 33) + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

interface Block {
  name: string;
  start: number;
  end: number;
  body: string;
}

function extractBlocksJS(lines: string[]): Block[] {
  const blocks: Block[] = [];
  const nameRe = /(?:(?:async\s+)?function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(|^\s*(?:async\s+)?(\w+)\s*\()/;

  for (let i = 0; i < lines.length; i++) {
    const m = nameRe.exec(lines[i]);
    if (!m) continue;
    const name = (m[1] || m[2] || m[3] || 'anon').trim();
    if (['if', 'for', 'while', 'switch', 'catch'].includes(name)) continue;

    let depth = 0, started = false, end = i;
    for (let j = i; j < Math.min(i + 300, lines.length); j++) {
      for (const ch of lines[j]) {
        if (ch === '{') { depth++; started = true; }
        else if (ch === '}') depth--;
      }
      if (started && depth === 0) { end = j; break; }
    }
    if (end - i < 4) continue;
    blocks.push({ name, start: i + 1, end: end + 1, body: lines.slice(i, end + 1).join('\n') });
  }
  return blocks;
}

function extractBlocksPython(lines: string[]): Block[] {
  const blocks: Block[] = [];
  const defRe = /^(\s*)(?:async\s+)?def\s+(\w+)/;

  for (let i = 0; i < lines.length; i++) {
    const m = defRe.exec(lines[i]);
    if (!m) continue;
    const indent = m[1].length;
    const name = m[2];
    let end = i + 1;
    while (end < lines.length && (lines[end].trim() === '' || (lines[end].match(/^(\s*)/)?.[1].length ?? 0) > indent)) end++;
    if (end - i < 4) continue;
    blocks.push({ name, start: i + 1, end, body: lines.slice(i, end).join('\n') });
  }
  return blocks;
}

function extractBlocksGo(lines: string[]): Block[] {
  const blocks: Block[] = [];
  const fnRe = /^func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)\s*\(/;

  for (let i = 0; i < lines.length; i++) {
    const m = fnRe.exec(lines[i]);
    if (!m) continue;
    const name = m[1];
    let depth = 0, started = false, end = i;
    for (let j = i; j < Math.min(i + 300, lines.length); j++) {
      for (const ch of lines[j]) {
        if (ch === '{') { depth++; started = true; }
        else if (ch === '}') depth--;
      }
      if (started && depth === 0) { end = j; break; }
    }
    if (end - i < 4) continue;
    blocks.push({ name, start: i + 1, end: end + 1, body: lines.slice(i, end + 1).join('\n') });
  }
  return blocks;
}

function extractBlocks(content: string, filePath: string): Block[] {
  const ext = path.extname(filePath).toLowerCase();
  const lines = content.split('\n');
  if (['.ts', '.tsx', '.js', '.jsx', '.mjs'].includes(ext)) return extractBlocksJS(lines);
  if (ext === '.py') return extractBlocksPython(lines);
  if (ext === '.go') return extractBlocksGo(lines);
  return [];
}

export async function analyzeDupes(rootDir: string, minLines = 6): Promise<DupesResult> {
  const start = Date.now();
  const hashMap = new Map<string, DuplicateOccurrence[]>();

  const files = await fg('**/*', { cwd: rootDir, absolute: true, onlyFiles: true, ignore: IGNORE });
  const sourceFiles = files.filter(f => SOURCE_EXTS.has(path.extname(f).toLowerCase()));

  for (const file of sourceFiles) {
    let content: string;
    try { content = fs.readFileSync(file, 'utf-8'); } catch { continue; }

    for (const block of extractBlocks(content, file)) {
      if (block.end - block.start + 1 < minLines) continue;
      const norm = normalize(block.body);
      if (norm.length < 60) continue;
      const hash = djb2(norm);
      if (!hashMap.has(hash)) hashMap.set(hash, []);
      hashMap.get(hash)!.push({ file, startLine: block.start, endLine: block.end, name: block.name });
    }
  }

  const duplicateGroups: DuplicateGroup[] = [];
  for (const [, occurrences] of hashMap) {
    if (occurrences.length < 2) continue;
    const lineCount = occurrences[0].endLine - occurrences[0].startLine + 1;
    const norm = normalize(fs.readFileSync(occurrences[0].file, 'utf-8').split('\n').slice(occurrences[0].startLine - 1, occurrences[0].endLine).join('\n'));
    duplicateGroups.push({ occurrences, lineCount, normalizedSize: norm.length });
  }

  duplicateGroups.sort((a, b) => b.lineCount - a.lineCount);

  return { scannedFiles: sourceFiles.length, duplicateGroups, durationMs: Date.now() - start };
}
