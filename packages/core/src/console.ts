import * as fs from 'fs';
import * as path from 'path';
import fg from 'fast-glob';

export type ConsoleKind = 'log' | 'warn' | 'debug' | 'info' | 'error' | 'print' | 'trace' | 'dir';

export interface ConsoleStatement {
  file: string;
  line: number;
  snippet: string;
  kind: ConsoleKind;
  language: string;
}

export interface ConsoleResult {
  scannedFiles: number;
  statements: ConsoleStatement[];
  byKind: Record<string, number>;
  byLanguage: Record<string, number>;
  durationMs: number;
}

const IGNORE = ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**', '**/vendor/**', '**/target/**'];
const TEST_PATTERNS = [/\.(test|spec)\.[jt]sx?$/, /__(tests?|mocks?)__/, /\/tests?\//, /\/spec\//];

function isTestFile(file: string): boolean {
  return TEST_PATTERNS.some(p => p.test(file));
}

interface LangRule {
  ext: string[];
  name: string;
  patterns: Array<{ re: RegExp; kind: ConsoleKind }>;
}

const LANG_RULES: LangRule[] = [
  {
    name: 'javascript',
    ext: ['.js', '.jsx', '.mjs', '.cjs'],
    patterns: [
      { re: /console\.(log|warn|debug|info|error|trace|dir)\s*\(/, kind: 'log' },
    ],
  },
  {
    name: 'typescript',
    ext: ['.ts', '.tsx'],
    patterns: [
      { re: /console\.(log|warn|debug|info|error|trace|dir)\s*\(/, kind: 'log' },
    ],
  },
  {
    name: 'python',
    ext: ['.py'],
    patterns: [
      { re: /^\s*print\s*\(/, kind: 'print' },
      { re: /\bpprint\s*\(/, kind: 'debug' },
      { re: /\blogging\.(debug|info|warning|error|critical)\s*\(/, kind: 'log' },
    ],
  },
  {
    name: 'go',
    ext: ['.go'],
    patterns: [
      { re: /\bfmt\.(Print|Println|Printf|Fprintf|Sprintf)\s*\(/, kind: 'print' },
      { re: /\blog\.(Print|Println|Printf|Fatal|Fatalf|Fatalln|Panic)\s*\(/, kind: 'log' },
    ],
  },
  {
    name: 'java',
    ext: ['.java'],
    patterns: [
      { re: /System\.out\.(print|println|printf)\s*\(/, kind: 'print' },
      { re: /System\.err\.(print|println|printf)\s*\(/, kind: 'error' },
      { re: /e\.printStackTrace\s*\(/, kind: 'error' },
    ],
  },
  {
    name: 'ruby',
    ext: ['.rb'],
    patterns: [
      { re: /^\s*p\s+/, kind: 'debug' },
      { re: /^\s*puts\s+/, kind: 'print' },
      { re: /^\s*pp\s+/, kind: 'debug' },
      { re: /\$stderr\.puts/, kind: 'error' },
    ],
  },
  {
    name: 'rust',
    ext: ['.rs'],
    patterns: [
      { re: /\bprintln!\s*\(/, kind: 'print' },
      { re: /\bprint!\s*\(/, kind: 'print' },
      { re: /\beprintln!\s*\(/, kind: 'error' },
      { re: /\bdbg!\s*\(/, kind: 'debug' },
    ],
  },
  {
    name: 'php',
    ext: ['.php'],
    patterns: [
      { re: /\bvar_dump\s*\(/, kind: 'debug' },
      { re: /\bprint_r\s*\(/, kind: 'debug' },
      { re: /\becho\s+/, kind: 'print' },
      { re: /\bvar_export\s*\(/, kind: 'debug' },
    ],
  },
  {
    name: 'csharp',
    ext: ['.cs'],
    patterns: [
      { re: /Console\.(Write|WriteLine|Error\.Write|Error\.WriteLine)\s*\(/, kind: 'print' },
      { re: /Debug\.(Write|WriteLine|Print)\s*\(/, kind: 'debug' },
      { re: /Trace\.(Write|WriteLine)\s*\(/, kind: 'trace' },
    ],
  },
];

const EXT_TO_RULE = new Map<string, LangRule>();
for (const rule of LANG_RULES) {
  for (const ext of rule.ext) EXT_TO_RULE.set(ext, rule);
}

export async function analyzeConsole(rootDir: string, skipTests = true): Promise<ConsoleResult> {
  const start = Date.now();
  const statements: ConsoleStatement[] = [];

  const files = await fg('**/*', { cwd: rootDir, absolute: true, onlyFiles: true, ignore: IGNORE });
  const sourceFiles = files.filter(f => EXT_TO_RULE.has(path.extname(f).toLowerCase()));

  for (const file of sourceFiles) {
    if (skipTests && isTestFile(file)) continue;

    let content: string;
    try { content = fs.readFileSync(file, 'utf-8'); } catch { continue; }

    const ext = path.extname(file).toLowerCase();
    const rule = EXT_TO_RULE.get(ext);
    if (!rule) continue;

    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Skip comment lines
      if (/^\s*(?:\/\/|#|\*|\/\*)/.test(line)) continue;

      for (const { re, kind: baseKind } of rule.patterns) {
        const m = re.exec(line);
        if (!m) continue;

        // Determine specific kind from match group if available
        const matchedMethod = m[1] as string | undefined;
        let kind: ConsoleKind = baseKind;
        if (matchedMethod) {
          const lower = matchedMethod.toLowerCase();
          if (lower === 'warn' || lower === 'warning') kind = 'warn';
          else if (lower === 'debug') kind = 'debug';
          else if (lower === 'info') kind = 'info';
          else if (lower === 'error' || lower === 'err') kind = 'error';
          else if (lower === 'trace') kind = 'trace';
          else if (lower === 'dir') kind = 'dir';
          else if (lower === 'log') kind = 'log';
        }

        statements.push({
          file,
          line: i + 1,
          snippet: line.trim().slice(0, 120),
          kind,
          language: rule.name,
        });
        break; // one match per line
      }
    }
  }

  const byKind: Record<string, number> = {};
  const byLanguage: Record<string, number> = {};
  for (const s of statements) {
    byKind[s.kind] = (byKind[s.kind] ?? 0) + 1;
    byLanguage[s.language] = (byLanguage[s.language] ?? 0) + 1;
  }

  return { scannedFiles: sourceFiles.length, statements, byKind, byLanguage, durationMs: Date.now() - start };
}
