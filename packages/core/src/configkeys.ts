import * as fs from 'fs';
import * as path from 'path';
import fg from 'fast-glob';

export interface DeadConfigKey {
  key: string;
  value: string;
  declaredIn: string;
  reason: string;
}

export interface ConfigKeysResult {
  scannedFiles: number;
  configFiles: number;
  deadKeys: DeadConfigKey[];
  durationMs: number;
}

const IGNORE = ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**', '**/vendor/**'];
const SOURCE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.py', '.go', '.java', '.rb', '.rs', '.php', '.cs']);

const ENV_FILE_NAMES = new Set([
  '.env', '.env.example', '.env.sample', '.env.local',
  '.env.development', '.env.staging', '.env.production', '.env.test',
]);

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

export async function analyzeConfigKeys(rootDir: string): Promise<ConfigKeysResult> {
  const start = Date.now();
  const allKeys = new Map<string, { value: string; file: string }>();

  // Find .env files
  const dotFiles = await fg('**/.env*', { cwd: rootDir, absolute: true, onlyFiles: true, ignore: IGNORE, dot: true });
  for (const f of dotFiles) {
    if (!ENV_FILE_NAMES.has(path.basename(f))) continue;
    for (const [key, value] of loadEnvKeys(f)) allKeys.set(key, { value, file: f });
  }

  // Find config JSON files
  const configJsonFiles = await fg(
    ['config.json', 'config.*.json', 'settings.json', 'settings.*.json', '.config.json'],
    { cwd: rootDir, absolute: true, onlyFiles: true, ignore: IGNORE },
  );
  for (const f of configJsonFiles) {
    for (const [key, value] of loadJsonKeys(f)) allKeys.set(key, { value, file: f });
  }

  const configFiles = dotFiles.length + configJsonFiles.length;

  if (allKeys.size === 0) {
    return { scannedFiles: 0, configFiles, deadKeys: [], durationMs: Date.now() - start };
  }

  // Scan source files and concat all content
  const sourceFiles = await fg('**/*', { cwd: rootDir, absolute: true, onlyFiles: true, ignore: IGNORE });
  const filtered = sourceFiles.filter(f => SOURCE_EXTS.has(path.extname(f).toLowerCase()));

  // Build a single string to search against (fast substring checks)
  const allContent = filtered
    .map(f => { try { return fs.readFileSync(f, 'utf-8'); } catch { return ''; } })
    .join('\n');

  const deadKeys: DeadConfigKey[] = [];
  for (const [key, { value, file }] of allKeys) {
    if (key.length < 2) continue; // skip trivially short keys
    if (allContent.includes(key)) continue;

    deadKeys.push({
      key,
      value: value.length > 50 ? value.slice(0, 50) + '...' : value,
      declaredIn: file,
      reason: 'Key is declared but never referenced in any source file',
    });
  }

  deadKeys.sort((a, b) => a.key.localeCompare(b.key));

  return { scannedFiles: filtered.length, configFiles, deadKeys, durationMs: Date.now() - start };
}
