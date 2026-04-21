import * as fs from 'fs';
import * as path from 'path';
import fg from 'fast-glob';

export interface UnusedFile {
  file: string;
  sizeBytes: number;
  reason: string;
}

export interface FilesResult {
  scannedFiles: number;
  unusedFiles: UnusedFile[];
  durationMs: number;
}

const IGNORE = ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**', '**/vendor/**', '**/target/**', '**/__pycache__/**'];
const SOURCE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.go', '.rb', '.rs', '.php', '.cs', '.java']);
const ENTRY_NAMES = new Set(['index', 'main', 'app', 'server', 'start', 'run', 'entry', 'bootstrap', 'init', 'setup', 'program']);

function resolveImport(from: string, importPath: string): string[] {
  const dir = path.dirname(from);
  const base = path.resolve(dir, importPath);
  return [
    base,
    base + '.ts', base + '.tsx', base + '.js', base + '.jsx', base + '.mjs',
    base + '/index.ts', base + '/index.tsx', base + '/index.js',
    base + '.py', base + '.rb', base + '.go',
  ];
}

function extractImports(content: string, filePath: string): string[] {
  const ext = path.extname(filePath).toLowerCase();
  const results: string[] = [];

  if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(ext)) {
    const patterns = [
      /from\s+['"](\.[^'"]+)['"]/g,
      /require\s*\(\s*['"](\.[^'"]+)['"]\s*\)/g,
      /import\s*\(\s*['"](\.[^'"]+)['"]\s*\)/g,
    ];
    for (const re of patterns) {
      let m: RegExpExecArray | null;
      while ((m = re.exec(content)) !== null) results.push(m[1]);
    }
  } else if (ext === '.py') {
    let m: RegExpExecArray | null;
    const re = /from\s+(\.+[a-zA-Z0-9_.]*)\s+import/g;
    while ((m = re.exec(content)) !== null) {
      const rel = m[1].replace(/^\.+/, '').replace(/\./g, '/');
      if (rel) results.push('./' + rel);
    }
  } else if (ext === '.rb') {
    let m: RegExpExecArray | null;
    const re = /require_relative\s+['"]([^'"]+)['"]/g;
    while ((m = re.exec(content)) !== null) results.push('./' + m[1]);
  } else if (ext === '.go') {
    let m: RegExpExecArray | null;
    const re = /"(\.[^"]+)"/g;
    while ((m = re.exec(content)) !== null) results.push(m[1]);
  }

  return results;
}

export async function analyzeFiles(rootDir: string): Promise<FilesResult> {
  const start = Date.now();

  const allFiles = await fg('**/*', { cwd: rootDir, absolute: true, onlyFiles: true, ignore: IGNORE });
  const sourceFiles = allFiles.filter(f => SOURCE_EXTS.has(path.extname(f).toLowerCase()));

  const importedFiles = new Set<string>();

  for (const file of sourceFiles) {
    let content: string;
    try { content = fs.readFileSync(file, 'utf-8'); } catch { continue; }

    for (const imp of extractImports(content, file)) {
      for (const candidate of resolveImport(file, imp)) {
        if (fs.existsSync(candidate)) {
          importedFiles.add(fs.realpathSync(candidate));
          break;
        }
      }
    }
  }

  const unusedFiles: UnusedFile[] = [];
  for (const file of sourceFiles) {
    const real = fs.existsSync(file) ? fs.realpathSync(file) : file;
    if (importedFiles.has(real)) continue;

    const base = path.basename(file, path.extname(file)).toLowerCase();
    if (ENTRY_NAMES.has(base)) continue;
    if (/\.(test|spec|e2e)$/.test(base) || base.endsWith('_test') || base.startsWith('test_')) continue;
    if (base.startsWith('.')) continue;

    const stat = fs.statSync(file);
    unusedFiles.push({
      file,
      sizeBytes: stat.size,
      reason: 'Never imported by any other file in the project',
    });
  }

  unusedFiles.sort((a, b) => b.sizeBytes - a.sizeBytes);

  return { scannedFiles: sourceFiles.length, unusedFiles, durationMs: Date.now() - start };
}
