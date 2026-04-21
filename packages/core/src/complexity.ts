import * as fs from 'fs';
import * as path from 'path';
import fg from 'fast-glob';

export type ComplexityRisk = 'low' | 'medium' | 'high' | 'critical';

export interface FunctionComplexity {
  file: string;
  line: number;
  name: string;
  complexity: number;
  risk: ComplexityRisk;
  language: string;
}

export interface ComplexityResult {
  scannedFiles: number;
  functions: FunctionComplexity[];
  byRisk: Record<ComplexityRisk, number>;
  durationMs: number;
}

const IGNORE = ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**', '**/vendor/**', '**/target/**'];

function riskLevel(complexity: number): ComplexityRisk {
  if (complexity <= 5) return 'low';
  if (complexity <= 10) return 'medium';
  if (complexity <= 15) return 'high';
  return 'critical';
}

// Decision-point patterns that each add +1 to complexity
const JS_DECISIONS = /\b(if|else\s+if|for|while|do|switch|case|catch|&&|\|\||[?](?![?.:]))\b/g;
const PY_DECISIONS = /\b(if|elif|for|while|except|and|or)\b/g;
const GO_DECISIONS = /\b(if|for|case|select|&&|\|\|)\b/g;
const JAVA_DECISIONS = /\b(if|else\s+if|for|while|do|switch|case|catch|&&|\|\||[?](?![?.:]))\b/g;
const RB_DECISIONS = /\b(if|elsif|unless|for|while|until|rescue|when|&&|\|\||and\b|or\b)\b/g;
const RS_DECISIONS = /\b(if|else\s+if|for|while|loop|match|&&|\|\|)\b/g;

function countDecisions(text: string, re: RegExp): number {
  return (text.match(re) ?? []).length;
}

// JS/TS: extract named functions, arrow functions assigned to const, methods
const JS_FN_RE = /(?:^|\s)(?:(?:export\s+)?(?:async\s+)?function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[\w]+)\s*=>|(?:(\w+)\s*(?::\s*\w+)?\s*=\s*(?:async\s+)?function)|(\w+)\s*\([^)]*\)\s*\{)/gm;

function extractJsFunctions(content: string, file: string, lang: string): FunctionComplexity[] {
  const results: FunctionComplexity[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Match function declarations and arrow functions
    const fnDecl = /(?:(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\()/;
    // Also match class methods
    const methodDecl = /^\s*(?:async\s+|static\s+|private\s+|public\s+|protected\s+|override\s+)*(\w+)\s*\([^)]*\)\s*(?::\s*[\w<>\[\]|&, ]+)?\s*\{/;

    let name: string | null = null;
    let m = fnDecl.exec(line);
    if (m) name = m[1] ?? m[2] ?? null;
    else {
      m = methodDecl.exec(line);
      if (m && !['if', 'for', 'while', 'switch', 'catch', 'else'].includes(m[1])) {
        name = m[1];
      }
    }

    if (!name) continue;

    // Collect function body by brace matching
    let depth = 0;
    let bodyStart = -1;
    let bodyEnd = i;
    const bodyLines: string[] = [];

    for (let j = i; j < Math.min(i + 300, lines.length); j++) {
      for (const ch of lines[j]) {
        if (ch === '{') { if (depth === 0) bodyStart = j; depth++; }
        else if (ch === '}') depth--;
      }
      if (bodyStart >= 0 && depth > 0) bodyLines.push(lines[j]);
      if (bodyStart >= 0 && depth === 0) { bodyEnd = j; break; }
    }

    if (bodyLines.length < 2) continue;

    const body = bodyLines.join('\n');
    const complexity = 1 + countDecisions(body, JS_DECISIONS);
    const risk = riskLevel(complexity);

    if (risk !== 'low') {
      results.push({ file, line: i + 1, name, complexity, risk, language: lang });
    }

    i = Math.min(bodyEnd, i + 1); // skip past body
  }

  return results;
}

function extractPyFunctions(content: string, file: string): FunctionComplexity[] {
  const results: FunctionComplexity[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const m = /^\s*(?:async\s+)?def\s+(\w+)\s*\(/.exec(lines[i]);
    if (!m) continue;
    const name = m[1];
    const baseIndent = (lines[i].match(/^(\s*)/)?.[1].length ?? 0);

    const bodyLines: string[] = [];
    for (let j = i + 1; j < lines.length; j++) {
      const l = lines[j];
      if (/^\s*$/.test(l)) { bodyLines.push(l); continue; }
      const ind = l.match(/^(\s*)/)?.[1].length ?? 0;
      if (ind <= baseIndent) break;
      bodyLines.push(l);
    }

    if (bodyLines.length < 2) continue;
    const body = bodyLines.join('\n');
    const complexity = 1 + countDecisions(body, PY_DECISIONS);
    const risk = riskLevel(complexity);
    if (risk !== 'low') results.push({ file, line: i + 1, name, complexity, risk, language: 'python' });
  }
  return results;
}

function extractGoFunctions(content: string, file: string): FunctionComplexity[] {
  const results: FunctionComplexity[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const m = /^func\s+(?:\([^)]+\)\s+)?(\w+)\s*\(/.exec(lines[i]);
    if (!m) continue;
    const name = m[1];

    let depth = 0, bodyStart = -1, bodyEnd = i;
    const bodyLines: string[] = [];
    for (let j = i; j < Math.min(i + 300, lines.length); j++) {
      for (const ch of lines[j]) {
        if (ch === '{') { if (depth === 0) bodyStart = j; depth++; }
        else if (ch === '}') depth--;
      }
      if (bodyStart >= 0 && depth > 0) bodyLines.push(lines[j]);
      if (bodyStart >= 0 && depth === 0) { bodyEnd = j; break; }
    }

    if (bodyLines.length < 2) continue;
    const body = bodyLines.join('\n');
    const complexity = 1 + countDecisions(body, GO_DECISIONS);
    const risk = riskLevel(complexity);
    if (risk !== 'low') results.push({ file, line: i + 1, name, complexity, risk, language: 'go' });
    i = Math.min(bodyEnd, i + 1);
  }
  return results;
}

function extractJavaFunctions(content: string, file: string): FunctionComplexity[] {
  const results: FunctionComplexity[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = /(?:public|private|protected|static|final|synchronized|native|abstract|\s)+\s+[\w<>\[\]]+\s+(\w+)\s*\([^)]*\)\s*(?:throws\s+\w+\s*)?\{/.exec(line);
    if (!m) continue;
    const name = m[1];
    if (['if', 'for', 'while', 'catch', 'switch'].includes(name)) continue;

    let depth = 0, bodyStart = -1, bodyEnd = i;
    const bodyLines: string[] = [];
    for (let j = i; j < Math.min(i + 300, lines.length); j++) {
      for (const ch of lines[j]) {
        if (ch === '{') { if (depth === 0) bodyStart = j; depth++; }
        else if (ch === '}') depth--;
      }
      if (bodyStart >= 0 && depth > 0) bodyLines.push(lines[j]);
      if (bodyStart >= 0 && depth === 0) { bodyEnd = j; break; }
    }

    if (bodyLines.length < 2) continue;
    const body = bodyLines.join('\n');
    const complexity = 1 + countDecisions(body, JAVA_DECISIONS);
    const risk = riskLevel(complexity);
    if (risk !== 'low') results.push({ file, line: i + 1, name, complexity, risk, language: 'java' });
    i = Math.min(bodyEnd, i + 1);
  }
  return results;
}

function extractRubyFunctions(content: string, file: string): FunctionComplexity[] {
  const results: FunctionComplexity[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const m = /^\s*def\s+(\w+)/.exec(lines[i]);
    if (!m) continue;
    const name = m[1];

    const bodyLines: string[] = [];
    let depth = 1;
    for (let j = i + 1; j < lines.length; j++) {
      const l = lines[j];
      if (/\b(?:def|do|begin|class|module|if|unless|while|for|until|case)\b/.test(l)) depth++;
      if (/\bend\b/.test(l)) { depth--; if (depth === 0) break; }
      bodyLines.push(l);
    }

    if (bodyLines.length < 2) continue;
    const body = bodyLines.join('\n');
    const complexity = 1 + countDecisions(body, RB_DECISIONS);
    const risk = riskLevel(complexity);
    if (risk !== 'low') results.push({ file, line: i + 1, name, complexity, risk, language: 'ruby' });
  }
  return results;
}

function extractRustFunctions(content: string, file: string): FunctionComplexity[] {
  const results: FunctionComplexity[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const m = /(?:pub\s+)?(?:async\s+)?fn\s+(\w+)\s*[<(]/.exec(lines[i]);
    if (!m) continue;
    const name = m[1];

    let depth = 0, bodyStart = -1, bodyEnd = i;
    const bodyLines: string[] = [];
    for (let j = i; j < Math.min(i + 300, lines.length); j++) {
      for (const ch of lines[j]) {
        if (ch === '{') { if (depth === 0) bodyStart = j; depth++; }
        else if (ch === '}') depth--;
      }
      if (bodyStart >= 0 && depth > 0) bodyLines.push(lines[j]);
      if (bodyStart >= 0 && depth === 0) { bodyEnd = j; break; }
    }

    if (bodyLines.length < 2) continue;
    const body = bodyLines.join('\n');
    const complexity = 1 + countDecisions(body, RS_DECISIONS);
    const risk = riskLevel(complexity);
    if (risk !== 'low') results.push({ file, line: i + 1, name, complexity, risk, language: 'rust' });
    i = Math.min(bodyEnd, i + 1);
  }
  return results;
}

export async function analyzeComplexity(rootDir: string, threshold = 5): Promise<ComplexityResult> {
  const start = Date.now();
  const functions: FunctionComplexity[] = [];

  const files = await fg('**/*', { cwd: rootDir, absolute: true, onlyFiles: true, ignore: IGNORE });

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    let content: string;
    try { content = fs.readFileSync(file, 'utf-8'); } catch { continue; }

    let found: FunctionComplexity[] = [];
    if (['.ts', '.tsx'].includes(ext)) found = extractJsFunctions(content, file, 'typescript');
    else if (['.js', '.jsx', '.mjs'].includes(ext)) found = extractJsFunctions(content, file, 'javascript');
    else if (ext === '.py') found = extractPyFunctions(content, file);
    else if (ext === '.go') found = extractGoFunctions(content, file);
    else if (ext === '.java') found = extractJavaFunctions(content, file);
    else if (ext === '.rb') found = extractRubyFunctions(content, file);
    else if (ext === '.rs') found = extractRustFunctions(content, file);

    functions.push(...found.filter(f => f.complexity >= threshold));
  }

  functions.sort((a, b) => b.complexity - a.complexity);

  const byRisk: Record<ComplexityRisk, number> = { low: 0, medium: 0, high: 0, critical: 0 };
  for (const f of functions) byRisk[f.risk]++;

  return { scannedFiles: files.length, functions, byRisk, durationMs: Date.now() - start };
}
