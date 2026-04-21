import * as fs from 'fs';
import * as path from 'path';
import fg from 'fast-glob';
import type { DeadDependency, DepsResult } from './types';

interface PackageManifest {
  manager: string;
  declaredIn: string;
  packages: Map<string, string>; // name -> version
}

// ── Manifest parsers ─────────────────────────────────────────────────────────

function parseNpmManifest(rootDir: string): PackageManifest | null {
  const pkgPath = path.join(rootDir, 'package.json');
  if (!fs.existsSync(pkgPath)) return null;
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    const packages = new Map<string, string>();
    for (const [k, v] of Object.entries({ ...pkg.dependencies, ...pkg.devDependencies })) {
      packages.set(k, String(v));
    }
    return { manager: 'npm', declaredIn: pkgPath, packages };
  } catch { return null; }
}

function parsePipManifest(rootDir: string): PackageManifest | null {
  const reqPath = path.join(rootDir, 'requirements.txt');
  if (!fs.existsSync(reqPath)) return null;
  const packages = new Map<string, string>();
  fs.readFileSync(reqPath, 'utf-8').split('\n').forEach(line => {
    const clean = line.trim().split('#')[0].trim();
    if (!clean) return;
    const match = /^([A-Za-z0-9_.-]+)/.exec(clean);
    if (match) packages.set(match[1].toLowerCase(), clean);
  });
  return { manager: 'pip', declaredIn: reqPath, packages };
}

function parseGoManifest(rootDir: string): PackageManifest | null {
  const modPath = path.join(rootDir, 'go.mod');
  if (!fs.existsSync(modPath)) return null;
  const packages = new Map<string, string>();
  const content = fs.readFileSync(modPath, 'utf-8');
  const requireBlock = /require\s*\(([\s\S]*?)\)/g;
  const singleRequire = /^require\s+(\S+)\s+(\S+)/gm;
  let m: RegExpExecArray | null;
  while ((m = requireBlock.exec(content)) !== null) {
    m[1].split('\n').forEach(line => {
      const lm = /^\s*(\S+)\s+(\S+)/.exec(line);
      if (lm && !lm[1].startsWith('//')) packages.set(lm[1], lm[2]);
    });
  }
  while ((m = singleRequire.exec(content)) !== null) {
    packages.set(m[1], m[2]);
  }
  return { manager: 'go', declaredIn: modPath, packages };
}

function parseCargoManifest(rootDir: string): PackageManifest | null {
  const cargoPath = path.join(rootDir, 'Cargo.toml');
  if (!fs.existsSync(cargoPath)) return null;
  const packages = new Map<string, string>();
  const content = fs.readFileSync(cargoPath, 'utf-8');
  let inDeps = false;
  for (const line of content.split('\n')) {
    if (/^\[dependencies\]/.test(line) || /^\[dev-dependencies\]/.test(line)) { inDeps = true; continue; }
    if (/^\[/.test(line)) { inDeps = false; continue; }
    if (inDeps) {
      const m = /^([a-zA-Z0-9_-]+)\s*=/.exec(line.trim());
      if (m) packages.set(m[1], line);
    }
  }
  return { manager: 'cargo', declaredIn: cargoPath, packages };
}

function parseGemfileManifest(rootDir: string): PackageManifest | null {
  const gemPath = path.join(rootDir, 'Gemfile');
  if (!fs.existsSync(gemPath)) return null;
  const packages = new Map<string, string>();
  fs.readFileSync(gemPath, 'utf-8').split('\n').forEach(line => {
    const m = /^\s*gem\s+['"]([^'"]+)['"]/.exec(line);
    if (m) packages.set(m[1], line);
  });
  return { manager: 'gem', declaredIn: gemPath, packages };
}

// ── Import scanners ──────────────────────────────────────────────────────────

function extractNpmImports(content: string): Set<string> {
  const imports = new Set<string>();
  const patterns = [
    /from\s+['"]([^.][^'"]*)['"]/g,
    /require\s*\(\s*['"]([^.][^'"]*)['"]\s*\)/g,
    /import\s*\(\s*['"]([^.][^'"]*)['"]\s*\)/g,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) {
      const pkg = m[1].split('/')[0].replace(/^@[^/]+\/[^/]+/, match => match);
      // Handle scoped packages like @scope/pkg
      if (m[1].startsWith('@')) {
        imports.add(m[1].split('/').slice(0, 2).join('/'));
      } else {
        imports.add(m[1].split('/')[0]);
      }
    }
  }
  return imports;
}

function extractPipImports(content: string): Set<string> {
  const imports = new Set<string>();
  const patterns = [/^import\s+([a-zA-Z0-9_]+)/gm, /^from\s+([a-zA-Z0-9_]+)/gm];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) imports.add(m[1].toLowerCase());
  }
  return imports;
}

function extractGoImports(content: string): Set<string> {
  const imports = new Set<string>();
  const blockRe = /import\s*\(([\s\S]*?)\)/g;
  const singleRe = /^import\s+"([^"]+)"/gm;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(content)) !== null) {
    m[1].split('\n').forEach(line => {
      const lm = /"([^"]+)"/.exec(line);
      if (lm) imports.add(lm[1]);
    });
  }
  while ((m = singleRe.exec(content)) !== null) imports.add(m[1]);
  return imports;
}

function extractRustImports(content: string): Set<string> {
  const imports = new Set<string>();
  const re = /^(?:use|extern\s+crate)\s+([a-zA-Z0-9_]+)/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) imports.add(m[1]);
  return imports;
}

// ── Main analysis ────────────────────────────────────────────────────────────

export async function analyzeDeps(rootDir: string): Promise<DepsResult> {
  const start = Date.now();
  const dead: DeadDependency[] = [];

  const manifests: PackageManifest[] = [
    parseNpmManifest(rootDir),
    parsePipManifest(rootDir),
    parseGoManifest(rootDir),
    parseCargoManifest(rootDir),
  ].filter(Boolean) as PackageManifest[];

  if (manifests.length === 0) {
    return { scannedFiles: 0, deadDependencies: [], durationMs: Date.now() - start };
  }

  // Gather all source files
  const files = await fg('**/*', {
    cwd: rootDir, absolute: true, onlyFiles: true,
    ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**', '**/vendor/**'],
  });

  const allNpmImports = new Set<string>();
  const allPipImports = new Set<string>();
  const allGoImports = new Set<string>();
  const allRustImports = new Set<string>();

  for (const file of files) {
    let content: string;
    try { content = fs.readFileSync(file, 'utf-8'); } catch { continue; }
    const ext = path.extname(file).toLowerCase();

    if (['.ts', '.tsx', '.js', '.jsx', '.mjs'].includes(ext)) {
      for (const i of extractNpmImports(content)) allNpmImports.add(i);
    } else if (ext === '.py') {
      for (const i of extractPipImports(content)) allPipImports.add(i);
    } else if (ext === '.go') {
      for (const i of extractGoImports(content)) allGoImports.add(i);
    } else if (ext === '.rs') {
      for (const i of extractRustImports(content)) allRustImports.add(i);
    }
  }

  const importsByManager: Record<string, Set<string>> = {
    npm: allNpmImports,
    pip: allPipImports,
    go: allGoImports,
    cargo: allRustImports,
  };

  for (const manifest of manifests) {
    const usedImports = importsByManager[manifest.manager] ?? new Set();
    for (const [pkgName, version] of manifest.packages) {
      // Skip peer deps, type-only, and commonly implicit packages
      if (pkgName.startsWith('@types/')) continue;
      if (['typescript', 'ts-node', 'nodemon', 'concurrently'].includes(pkgName)) continue;

      const isUsed = [...usedImports].some(imp =>
        imp === pkgName || imp.startsWith(pkgName + '/') || pkgName.includes(imp)
      );

      if (!isUsed) {
        dead.push({
          name: pkgName,
          manager: manifest.manager,
          declaredIn: manifest.declaredIn,
          installedVersion: version,
        });
      }
    }
  }

  return { scannedFiles: files.length, deadDependencies: dead, durationMs: Date.now() - start };
}
