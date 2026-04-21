import * as fs from 'fs';
import * as path from 'path';
import fg from 'fast-glob';

export interface UnusedFile {
  file: string;
  sizeBytes: number;
  lastModified: Date;
  reason: string;
  isBarrel: boolean; // re-export-only file
}

export interface FilesResult {
  scannedFiles: number;
  unusedFiles: UnusedFile[];
  totalBytes: number;
  durationMs: number;
}

const IGNORE = ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**', '**/vendor/**', '**/target/**', '**/__pycache__/**', '**/*.d.ts'];
const SOURCE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.go', '.rb', '.rs', '.php', '.cs', '.java']);
const ENTRY_NAMES = new Set(['index', 'main', 'app', 'server', 'start', 'run', 'entry', 'bootstrap', 'init', 'setup', 'program', 'manage', 'wsgi', 'asgi']);

function loadTsConfigPaths(rootDir: string): Map<string, string[]> {
  const result = new Map<string, string[]>();
  for (const name of ['tsconfig.json', 'tsconfig.base.json', 'jsconfig.json']) {
    const p = path.join(rootDir, name);
    if (!fs.existsSync(p)) continue;
    try {
      const cfg = JSON.parse(fs.readFileSync(p, 'utf-8'));
      const baseUrl = path.resolve(rootDir, cfg.compilerOptions?.baseUrl ?? '.');
      for (const [alias, targets] of Object.entries((cfg.compilerOptions?.paths ?? {}) as Record<string, string[]>)) {
        const key = alias.replace(/\/\*$/, '');
        result.set(key, targets.map(t => path.resolve(baseUrl, t.replace(/\/\*$/, ''))));
      }
    } catch { /* ignore */ }
  }
  return result;
}

function loadPackageEntryPoints(rootDir: string): Set<string> {
  const entries = new Set<string>();
  const pkgPath = path.join(rootDir, 'package.json');
  if (!fs.existsSync(pkgPath)) return entries;
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    const add = (v: unknown) => {
      if (typeof v === 'string' && /\.[jt]sx?$/.test(v)) {
        const resolved = path.resolve(rootDir, v);
        entries.add(resolved);
        entries.add(resolved.replace(/\.[jt]sx?$/, '.ts'));
        entries.add(resolved.replace(/\.[jt]sx?$/, '.tsx'));
        entries.add(resolved.replace(/\.[jt]sx?$/, '.js'));
      } else if (typeof v === 'object' && v !== null) {
        for (const val of Object.values(v as Record<string, unknown>)) add(val);
      }
    };
    add(pkg.main); add(pkg.module); add(pkg.exports); add(pkg.bin);
  } catch { /* ignore */ }
  return entries;
}

function resolveImportPath(from: string, importPath: string, aliases: Map<string, string[]>): string[] {
  // Try alias resolution first
  for (const [alias, targets] of aliases) {
    if (importPath === alias || importPath.startsWith(alias + '/')) {
      const suffix = importPath.slice(alias.length).replace(/^\//, '');
      return targets.flatMap(t => {
        const base = suffix ? path.join(t, suffix) : t;
        return expandCandidates(base);
      });
    }
  }

  // Relative import
  if (importPath.startsWith('.')) {
    const base = path.resolve(path.dirname(from), importPath);
    return expandCandidates(base);
  }

  return [];
}

function expandCandidates(base: string): string[] {
  return [
    base,
    base + '.ts', base + '.tsx', base + '.js', base + '.jsx', base + '.mjs',
    base + '/index.ts', base + '/index.tsx', base + '/index.js',
    base + '.py', base + '.rb', base + '.go', base + '.rs',
  ];
}

function extractImports(content: string, filePath: string): string[] {
  const ext = path.extname(filePath).toLowerCase();
  const results: string[] = [];

  if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(ext)) {
    const patterns = [
      /from\s+['"]([^'"]+)['"]/g,
      /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
      /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
      /export\s+\*\s+from\s+['"]([^'"]+)['"]/g,
      /export\s+\{[^}]*\}\s+from\s+['"]([^'"]+)['"]/g,
    ];
    for (const re of patterns) {
      let m: RegExpExecArray | null;
      while ((m = re.exec(content)) !== null) results.push(m[1]);
    }
  } else if (ext === '.py') {
    let m: RegExpExecArray | null;
    // relative imports: from .module import ...
    const rel = /from\s+(\.+[a-zA-Z0-9_.]*)\s+import/g;
    while ((m = rel.exec(content)) !== null) {
      const dots = m[1].match(/^(\.+)/)?.[1].length ?? 1;
      const mod = m[1].replace(/^\.+/, '').replace(/\./g, '/');
      const dir = path.dirname(filePath);
      let base = dir;
      for (let i = 1; i < dots; i++) base = path.dirname(base);
      results.push(path.join(base, mod || '__init__'));
    }
  } else if (ext === '.rb') {
    let m: RegExpExecArray | null;
    const re = /require_relative\s+['"]([^'"]+)['"]/g;
    while ((m = re.exec(content)) !== null) results.push(path.resolve(path.dirname(filePath), m[1]));
  } else if (ext === '.go') {
    // local package imports (relative path style)
    let m: RegExpExecArray | null;
    const re = /"(\.[^"]+)"/g;
    while ((m = re.exec(content)) !== null) results.push(m[1]);
  }

  return results;
}

function isBarrelFile(content: string, ext: string): boolean {
  if (!['.ts', '.tsx', '.js', '.jsx'].includes(ext)) return false;
  const lines = content.split('\n').filter(l => l.trim() && !l.trim().startsWith('//'));
  return lines.length > 0 && lines.every(l => /^export\s+(?:\*|\{)/.test(l.trim()) || /^\/\//.test(l.trim()));
}

export async function analyzeFiles(rootDir: string): Promise<FilesResult> {
  const start = Date.now();

  const aliases = loadTsConfigPaths(rootDir);
  const packageEntryPoints = loadPackageEntryPoints(rootDir);

  const allFiles = await fg('**/*', { cwd: rootDir, absolute: true, onlyFiles: true, ignore: IGNORE });
  const sourceFiles = allFiles.filter(f => SOURCE_EXTS.has(path.extname(f).toLowerCase()));

  const importedFiles = new Set<string>();

  // Add package entry points as imported
  for (const ep of packageEntryPoints) {
    for (const c of expandCandidates(ep.replace(/\.[jt]sx?$/, ''))) {
      if (fs.existsSync(c)) { importedFiles.add(c); break; }
    }
  }

  for (const file of sourceFiles) {
    let content: string;
    try { content = fs.readFileSync(file, 'utf-8'); } catch { continue; }
    const ext = path.extname(file).toLowerCase();

    for (const imp of extractImports(content, file)) {
      const candidates = imp.startsWith('/') || !imp.startsWith('.')
        ? resolveImportPath(file, imp, aliases)
        : expandCandidates(imp.startsWith('.') ? path.resolve(path.dirname(file), imp) : imp);

      for (const c of candidates) {
        if (fs.existsSync(c)) { importedFiles.add(c); break; }
      }
    }
  }

  const unusedFiles: UnusedFile[] = [];
  for (const file of sourceFiles) {
    if (importedFiles.has(file)) continue;

    const base = path.basename(file, path.extname(file)).toLowerCase();
    if (ENTRY_NAMES.has(base)) continue;
    if (/\.(test|spec|e2e|stories|story)$/.test(base)) continue;
    if (base.endsWith('_test') || base.startsWith('test_') || base.startsWith('__')) continue;

    // Skip Next.js/Remix pages, API routes, layouts
    const rel = path.relative(rootDir, file).replace(/\\/g, '/');
    if (/^(?:src\/)?(?:app|pages)\//.test(rel)) continue;

    // Skip config files
    if (/^(?:babel|jest|webpack|vite|rollup|eslint|prettier|postcss|tailwind|next|nuxt|svelte)\.(config|setup)/.test(base)) continue;

    let content = '';
    try { content = fs.readFileSync(file, 'utf-8'); } catch { /* ignore */ }

    const stat = fs.statSync(file);
    const ext = path.extname(file).toLowerCase();
    const barrel = isBarrelFile(content, ext);

    unusedFiles.push({
      file,
      sizeBytes: stat.size,
      lastModified: stat.mtime,
      reason: barrel ? 'Barrel (re-export only) file that nothing imports' : 'Never imported by any other file',
      isBarrel: barrel,
    });
  }

  unusedFiles.sort((a, b) => b.sizeBytes - a.sizeBytes);
  const totalBytes = unusedFiles.reduce((s, f) => s + f.sizeBytes, 0);

  return { scannedFiles: sourceFiles.length, unusedFiles, totalBytes, durationMs: Date.now() - start };
}
