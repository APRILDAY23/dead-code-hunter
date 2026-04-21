import * as fs from 'fs';
import * as path from 'path';
import type { Config } from './types';

const DEFAULTS: Config = {
  include: ['**/*'],
  exclude: [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/out/**',
    '**/.git/**',
    '**/vendor/**',
    '**/__pycache__/**',
    '**/target/**',
  ],
  entryPoints: [
    'index.ts', 'index.js', 'main.ts', 'main.js', 'app.ts', 'app.py',
    'main.go', 'main.py', 'main.rb', 'main.rs', 'Program.cs', 'Main.java',
  ],
  ignorePatterns: ['_*', '__*', 'test_*', '*_test', '*Test', '*Spec'],
  languages: ['typescript', 'javascript', 'python', 'go', 'java', 'ruby', 'rust', 'php', 'csharp'],
  minConfidence: 0.8,
};

export function loadConfig(rootDir: string): Config {
  const configFile = path.join(rootDir, '.dchrc.json');
  if (!fs.existsSync(configFile)) return DEFAULTS;

  try {
    const raw = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
    return { ...DEFAULTS, ...raw };
  } catch {
    return DEFAULTS;
  }
}
