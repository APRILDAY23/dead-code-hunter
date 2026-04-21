import * as fs from 'fs';
import * as path from 'path';
import fg from 'fast-glob';

export interface CircularCycle {
  cycle: string[];       // relative file paths forming the cycle
  length: number;        // number of nodes in cycle
}

export interface CircularResult {
  scannedFiles: number;
  cycles: CircularCycle[];
  durationMs: number;
}

const IGNORE = ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**', '**/vendor/**', '**/*.d.ts'];
const JS_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const PY_EXTS = new Set(['.py']);

// Extract JS/TS import paths from a file
function extractJsImports(content: string, fromFile: string, rootDir: string): string[] {
  const imports: string[] = [];
  // static imports: import ... from '...'
  const staticRe = /(?:import|export)\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g;
  // require(): const x = require('...')
  const requireRe = /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

  for (const re of [staticRe, requireRe]) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) {
      const spec = m[1];
      if (!spec.startsWith('.')) continue; // skip node_modules
      const resolved = resolveJsImport(spec, fromFile, rootDir);
      if (resolved) imports.push(resolved);
    }
  }
  return imports;
}

function resolveJsImport(spec: string, fromFile: string, rootDir: string): string | null {
  const dir = path.dirname(fromFile);
  const base = path.resolve(dir, spec);

  // Try exact path first
  const candidates = [
    base,
    base + '.ts', base + '.tsx', base + '.js', base + '.jsx', base + '.mjs',
    path.join(base, 'index.ts'), path.join(base, 'index.tsx'),
    path.join(base, 'index.js'), path.join(base, 'index.jsx'),
  ];

  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  }
  return null;
}

// Extract Python imports from a file
function extractPyImports(content: string, fromFile: string, rootDir: string): string[] {
  const imports: string[] = [];
  const dir = path.dirname(fromFile);

  // from . import x  /  from .module import x  /  from package import x
  const relRe = /from\s+(\.+)([\w.]*)\s+import/g;
  let m: RegExpExecArray | null;
  while ((m = relRe.exec(content)) !== null) {
    const dots = m[1].length;
    const modPath = m[2].replace(/\./g, path.sep);
    let base = dir;
    for (let i = 1; i < dots; i++) base = path.dirname(base);
    const resolved = modPath ? path.join(base, modPath) : base;
    const candidates = [resolved + '.py', path.join(resolved, '__init__.py')];
    for (const c of candidates) {
      if (fs.existsSync(c)) { imports.push(c); break; }
    }
  }

  // import package.module (only relative to rootDir)
  const absRe = /^import\s+([\w.]+)/gm;
  while ((m = absRe.exec(content)) !== null) {
    const modPath = m[1].replace(/\./g, path.sep);
    const resolved = path.join(rootDir, modPath);
    const candidates = [resolved + '.py', path.join(resolved, '__init__.py')];
    for (const c of candidates) {
      if (fs.existsSync(c)) { imports.push(c); break; }
    }
  }

  return imports;
}

// Johnson's algorithm (simplified): Tarjan SCC + cycle extraction via DFS
function findCycles(graph: Map<string, string[]>): string[][] {
  const nodes = [...graph.keys()];
  const index = new Map<string, number>();
  const lowlink = new Map<string, number>();
  const onStack = new Map<string, boolean>();
  const stack: string[] = [];
  const sccs: string[][] = [];
  let idx = 0;

  function strongconnect(v: string) {
    index.set(v, idx);
    lowlink.set(v, idx);
    idx++;
    stack.push(v);
    onStack.set(v, true);

    for (const w of (graph.get(v) ?? [])) {
      if (!index.has(w)) {
        strongconnect(w);
        lowlink.set(v, Math.min(lowlink.get(v)!, lowlink.get(w)!));
      } else if (onStack.get(w)) {
        lowlink.set(v, Math.min(lowlink.get(v)!, index.get(w)!));
      }
    }

    if (lowlink.get(v) === index.get(v)) {
      const scc: string[] = [];
      let w: string;
      do {
        w = stack.pop()!;
        onStack.set(w, false);
        scc.push(w);
      } while (w !== v);
      if (scc.length > 1) sccs.push(scc);
    }
  }

  for (const n of nodes) {
    if (!index.has(n)) strongconnect(n);
  }

  return sccs;
}

export async function analyzeCircular(rootDir: string): Promise<CircularResult> {
  const start = Date.now();

  const allFiles = await fg('**/*', { cwd: rootDir, absolute: true, onlyFiles: true, ignore: IGNORE });
  const jsFiles = allFiles.filter(f => JS_EXTS.has(path.extname(f).toLowerCase()));
  const pyFiles = allFiles.filter(f => PY_EXTS.has(path.extname(f).toLowerCase()));

  const graph = new Map<string, string[]>();

  for (const file of jsFiles) {
    let content: string;
    try { content = fs.readFileSync(file, 'utf-8'); } catch { continue; }
    const deps = extractJsImports(content, file, rootDir);
    graph.set(file, deps.filter(d => jsFiles.includes(d)));
  }

  for (const file of pyFiles) {
    let content: string;
    try { content = fs.readFileSync(file, 'utf-8'); } catch { continue; }
    const deps = extractPyImports(content, file, rootDir);
    graph.set(file, deps.filter(d => pyFiles.includes(d)));
  }

  const sccs = findCycles(graph);

  const cycles: CircularCycle[] = sccs.map(scc => ({
    cycle: scc.map(f => path.relative(rootDir, f)),
    length: scc.length,
  }));

  cycles.sort((a, b) => b.length - a.length);

  return {
    scannedFiles: jsFiles.length + pyFiles.length,
    cycles,
    durationMs: Date.now() - start,
  };
}
