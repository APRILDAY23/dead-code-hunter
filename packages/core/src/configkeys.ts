import * as fs from 'fs';
import * as path from 'path';
import fg from 'fast-glob';

export interface DeadConfigKey {
  key: string;
  value: string;
  declaredIn: string;
  reason: string;
  usedIn?: string[]; // files that DO reference this key (empty = truly dead)
}

export interface ConfigKeysResult {
  scannedFiles: number;
  configFiles: number;
  deadKeys: DeadConfigKey[];
  liveKeys: number;
  durationMs: number;
}

const IGNORE = ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**', '**/vendor/**'];
const SOURCE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.py', '.go', '.java', '.rb', '.rs', '.php', '.cs']);
const ENV_NAMES = new Set(['.env', '.env.example', '.env.sample', '.env.local', '.env.development', '.env.staging', '.env.production', '.env.test']);

function loadEnvKeys(filePath: string): Map<string, string> {
  const keys = new Map<string, string>();
  try {
    for (const line of fs.readFileSync(filePath, 'utf-8').split('\n')) {
      const clean = line.trim();
      if (!clean || clean.startsWith('#')) continue;
      const eq = clean.indexOf('=');
      if (eq === -1) continue;
      const key = clean.slice(0, eq).trim();
      if (key) keys.set(key, clean.slice(eq + 1).trim());
    }
  } catch { /* ignore */ }
  return keys;
}

function loadJsonKeys(filePath: string): Map<string, string> {
  const keys = new Map<string, string>();
  try {
    const flatten = (obj: unknown, prefix = '') => {
      if (obj !== null && typeof obj === 'object' && !Array.isArray(obj)) {
        for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
          flatten(v, prefix ? `${prefix}.${k}` : k);
        }
      } else {
        keys.set(prefix, String(obj));
      }
    };
    flatten(JSON.parse(fs.readFileSync(filePath, 'utf-8')));
  } catch { /* ignore */ }
  return keys;
}

/** Build all possible reference patterns for a given key */
function buildPatterns(key: string): string[] {
  return [
    // Raw key
    key,
    // JS/TS
    `process.env.${key}`,
    `process.env['${key}']`,
    `process.env["${key}"]`,
    // Python
    `os.environ['${key}']`,
    `os.environ["${key}"]`,
    `os.environ.get('${key}')`,
    `os.environ.get("${key}")`,
    `os.getenv('${key}')`,
    `os.getenv("${key}")`,
    `getenv('${key}')`,
    `getenv("${key}")`,
    // Ruby
    `ENV['${key}']`,
    `ENV["${key}"]`,
    `ENV.fetch('${key}')`,
    `ENV.fetch("${key}")`,
    // Go
    `os.Getenv("${key}")`,
    `os.Getenv('${key}')`,
    // PHP
    `$_ENV['${key}']`,
    `$_SERVER['${key}']`,
    `getenv('${key}')`,
    // Java
    `System.getenv("${key}")`,
  ];
}

export async function analyzeConfigKeys(rootDir: string): Promise<ConfigKeysResult> {
  const start = Date.now();
  const allKeys = new Map<string, { value: string; file: string }>();

  // Load .env files
  const dotFiles = await fg(['**/.env', '**/.env.*'], {
    cwd: rootDir, absolute: true, onlyFiles: true, ignore: IGNORE, dot: true,
  });
  for (const f of dotFiles) {
    if (!ENV_NAMES.has(path.basename(f))) continue;
    for (const [key, value] of loadEnvKeys(f)) allKeys.set(key, { value, file: f });
  }

  // Load config JSON/settings files
  const jsonFiles = await fg(
    ['config.json', 'config.*.json', 'settings.json', 'settings.*.json'],
    { cwd: rootDir, absolute: true, onlyFiles: true, ignore: IGNORE },
  );
  for (const f of jsonFiles) {
    for (const [key, value] of loadJsonKeys(f)) allKeys.set(key, { value, file: f });
  }

  const configFiles = dotFiles.length + jsonFiles.length;

  if (allKeys.size === 0) {
    return { scannedFiles: 0, configFiles, deadKeys: [], liveKeys: 0, durationMs: Date.now() - start };
  }

  // Read all source files
  const sourceFiles = await fg('**/*', { cwd: rootDir, absolute: true, onlyFiles: true, ignore: IGNORE });
  const filtered = sourceFiles.filter(f => SOURCE_EXTS.has(path.extname(f).toLowerCase()));

  const fileContents = new Map<string, string>();
  for (const f of filtered) {
    try { fileContents.set(f, fs.readFileSync(f, 'utf-8')); } catch { /* ignore */ }
  }

  const deadKeys: DeadConfigKey[] = [];
  let liveKeys = 0;

  for (const [key, { value, file }] of allKeys) {
    if (key.length < 2) continue;
    const patterns = buildPatterns(key);

    const referencingFiles: string[] = [];
    for (const [srcFile, content] of fileContents) {
      if (patterns.some(p => content.includes(p))) {
        referencingFiles.push(srcFile);
      }
    }

    if (referencingFiles.length === 0) {
      deadKeys.push({
        key,
        value: value.length > 60 ? value.slice(0, 60) + '...' : value,
        declaredIn: file,
        reason: 'Key is declared but never referenced in source code',
        usedIn: [],
      });
    } else {
      liveKeys++;
    }
  }

  deadKeys.sort((a, b) => a.key.localeCompare(b.key));

  return { scannedFiles: filtered.length, configFiles, deadKeys, liveKeys, durationMs: Date.now() - start };
}
