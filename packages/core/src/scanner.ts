import * as fs from 'fs';
import * as path from 'path';
import fg from 'fast-glob';
import ignore from 'ignore';
import type { Config } from './types';

const LANGUAGE_EXTENSIONS: Record<string, string[]> = {
  typescript: ['.ts', '.tsx'],
  javascript: ['.js', '.jsx', '.mjs', '.cjs'],
  python: ['.py'],
  go: ['.go'],
  java: ['.java'],
  ruby: ['.rb'],
  rust: ['.rs'],
  php: ['.php'],
  csharp: ['.cs'],
};

export async function scanFiles(rootDir: string, config: Config): Promise<string[]> {
  const ig = ignore();

  const gitignorePath = path.join(rootDir, '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    ig.add(fs.readFileSync(gitignorePath, 'utf-8'));
  }

  const allowedExts = new Set<string>();
  for (const lang of config.languages) {
    for (const ext of (LANGUAGE_EXTENSIONS[lang] ?? [])) {
      allowedExts.add(ext);
    }
  }

  const files = await fg('**/*', {
    cwd: rootDir,
    absolute: true,
    onlyFiles: true,
    ignore: config.exclude,
  });

  return files.filter(f => {
    const rel = path.relative(rootDir, f).replace(/\\/g, '/');
    if (ig.ignores(rel)) return false;
    return allowedExts.has(path.extname(f).toLowerCase());
  });
}

export function getLanguageForFile(filePath: string): string | null {
  const ext = path.extname(filePath).toLowerCase();
  for (const [lang, exts] of Object.entries(LANGUAGE_EXTENSIONS)) {
    if (exts.includes(ext)) return lang;
  }
  return null;
}
