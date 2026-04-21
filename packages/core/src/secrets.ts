import * as fs from 'fs';
import * as path from 'path';
import fg from 'fast-glob';

export type SecretKind =
  | 'password' | 'api_key' | 'token' | 'secret' | 'private_key'
  | 'aws_key' | 'github_token' | 'generic_high_entropy';

export interface SecretFinding {
  file: string;
  line: number;
  snippet: string;   // redacted: value replaced with ***
  kind: SecretKind;
  confidence: 'high' | 'medium' | 'low';
}

export interface SecretsResult {
  scannedFiles: number;
  findings: SecretFinding[];
  byKind: Record<string, number>;
  durationMs: number;
}

const IGNORE = [
  '**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**',
  '**/vendor/**', '**/target/**', '**/*.lock', '**/*.sum',
  '**/*.min.js', '**/*.map', '**/*.svg', '**/*.png', '**/*.jpg',
  '**/*.pdf', '**/*.zip', '**/*.tar', '**/*.gz',
  // Safe to skip - these are meant to have placeholder keys
  '**/.env.example', '**/.env.sample', '**/.env.template',
];

const SOURCE_EXTS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.py', '.go', '.java', '.rb',
  '.rs', '.php', '.cs', '.env', '.json', '.yaml', '.yml', '.toml', '.ini',
  '.conf', '.config', '.sh', '.bash', '.zsh',
]);

// Shannon entropy of a string
function entropy(s: string): number {
  const freq = new Map<string, number>();
  for (const c of s) freq.set(c, (freq.get(c) ?? 0) + 1);
  let h = 0;
  for (const count of freq.values()) {
    const p = count / s.length;
    h -= p * Math.log2(p);
  }
  return h;
}

function redact(line: string, value: string): string {
  if (!value || value.length < 4) return line;
  return line.replace(value, '*'.repeat(Math.min(value.length, 8)));
}

interface SecretPattern {
  name: SecretKind;
  confidence: 'high' | 'medium' | 'low';
  re: RegExp;
  valueGroup?: number; // capture group index for the secret value
}

const PATTERNS: SecretPattern[] = [
  // Specific token formats (high confidence)
  {
    name: 'aws_key',
    confidence: 'high',
    re: /\b(AKIA[0-9A-Z]{16})\b/,
    valueGroup: 1,
  },
  {
    name: 'github_token',
    confidence: 'high',
    re: /\b(gh[pousr]_[a-zA-Z0-9]{36,})\b/,
    valueGroup: 1,
  },
  {
    name: 'private_key',
    confidence: 'high',
    re: /-----BEGIN\s+(?:RSA\s+|EC\s+|DSA\s+|OPENSSH\s+)?PRIVATE KEY-----/,
  },
  // Assignment patterns (medium confidence - look for non-placeholder values)
  {
    name: 'password',
    confidence: 'medium',
    re: /(?:password|passwd|pwd)\s*(?:=|:)\s*['"]([^'"]{6,})['"](?!\s*#\s*placeholder)/i,
    valueGroup: 1,
  },
  {
    name: 'api_key',
    confidence: 'medium',
    re: /(?:api[_-]?key|apikey|app[_-]?key|app[_-]?secret)\s*(?:=|:)\s*['"]([^'"]{8,})['"](?!\s*#\s*placeholder)/i,
    valueGroup: 1,
  },
  {
    name: 'token',
    confidence: 'medium',
    re: /(?:access[_-]?token|auth[_-]?token|bearer[_-]?token|jwt[_-]?secret|refresh[_-]?token)\s*(?:=|:)\s*['"]([^'"]{8,})['"](?!\s*#\s*placeholder)/i,
    valueGroup: 1,
  },
  {
    name: 'secret',
    confidence: 'medium',
    re: /(?:secret[_-]?key|client[_-]?secret|signing[_-]?secret|webhook[_-]?secret|encryption[_-]?key)\s*(?:=|:)\s*['"]([^'"]{8,})['"](?!\s*#\s*placeholder)/i,
    valueGroup: 1,
  },
  // Database URLs with credentials
  {
    name: 'password',
    confidence: 'medium',
    re: /(?:mongodb|postgres|mysql|redis|amqp):\/\/[^:]+:([^@]{6,})@/i,
    valueGroup: 1,
  },
];

// Known placeholder values to skip
const PLACEHOLDERS = new Set([
  'your_api_key', 'your-api-key', 'your_password', 'your-password',
  'changeme', 'change_me', 'replace_me', 'todo', 'fixme',
  'xxxxxxxx', 'aaaaaaaa', '12345678', 'password123', 'secret123',
  'example', 'placeholder', 'insert_key_here', 'YOUR_KEY_HERE',
  'YOUR_SECRET_HERE', 'YOUR_TOKEN_HERE', 'MY_SECRET', 'MY_KEY',
]);

function isPlaceholder(value: string): boolean {
  const lower = value.toLowerCase();
  if (PLACEHOLDERS.has(lower)) return true;
  if (/^[a-z_-]+$/.test(lower)) return true; // all lowercase letters/dashes = probably a var name
  if (/^x+$/i.test(value)) return true;
  if (/^\*+$/.test(value)) return true;
  if (value.length < 6) return true;
  return false;
}

function checkHighEntropy(line: string, lineNum: number, file: string): SecretFinding | null {
  // Look for long quoted strings with high entropy assigned to sensitive variable names
  const m = /(?:key|secret|token|password|credential|auth)\s*(?:=|:)\s*['"]([a-zA-Z0-9+/=_\-]{20,})['"]/.exec(line);
  if (!m) return null;
  const value = m[1];
  if (isPlaceholder(value)) return null;
  const e = entropy(value);
  if (e < 3.5) return null; // low entropy = probably not a real secret
  return {
    file,
    line: lineNum,
    snippet: redact(line.trim(), value),
    kind: 'generic_high_entropy',
    confidence: e > 4.5 ? 'medium' : 'low',
  };
}

export async function analyzeSecrets(rootDir: string): Promise<SecretsResult> {
  const start = Date.now();
  const findings: SecretFinding[] = [];
  const seen = new Set<string>(); // deduplicate same value across files

  const files = await fg('**/*', { cwd: rootDir, absolute: true, onlyFiles: true, ignore: IGNORE });
  const sourceFiles = files.filter(f => SOURCE_EXTS.has(path.extname(f).toLowerCase()) || path.basename(f).startsWith('.env'));

  for (const file of sourceFiles) {
    // Skip test/fixture/mock files
    if (/\.(test|spec)\.[jt]sx?$/.test(file)) continue;
    if (/(?:__tests?__|fixtures?|mocks?|stubs?)/.test(file)) continue;

    let content: string;
    try { content = fs.readFileSync(file, 'utf-8'); } catch { continue; }

    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Skip comment lines
      if (/^\s*(?:\/\/|#|\*|\/\*|--|<!--)/.test(line)) continue;
      // Skip empty lines
      if (/^\s*$/.test(line)) continue;

      for (const pattern of PATTERNS) {
        const m = pattern.re.exec(line);
        if (!m) continue;

        const value = pattern.valueGroup !== undefined ? m[pattern.valueGroup] : '';
        if (value && isPlaceholder(value)) continue;

        // Deduplicate: same secret value in multiple files is one finding
        const dedupeKey = `${pattern.name}:${value || line.trim().slice(0, 40)}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);

        findings.push({
          file,
          line: i + 1,
          snippet: redact(line.trim().slice(0, 120), value),
          kind: pattern.name,
          confidence: pattern.confidence,
        });
        break;
      }

      // High-entropy check (low confidence, only if nothing else matched)
      const existing = findings.find(f => f.file === file && f.line === i + 1);
      if (!existing) {
        const hef = checkHighEntropy(line, i + 1, file);
        if (hef) {
          const dedupeKey = `entropy:${file}:${i + 1}`;
          if (!seen.has(dedupeKey)) {
            seen.add(dedupeKey);
            findings.push(hef);
          }
        }
      }
    }
  }

  // Sort: high confidence first
  const CONF_ORDER = { high: 0, medium: 1, low: 2 };
  findings.sort((a, b) => CONF_ORDER[a.confidence] - CONF_ORDER[b.confidence]);

  const byKind: Record<string, number> = {};
  for (const f of findings) byKind[f.kind] = (byKind[f.kind] ?? 0) + 1;

  return { scannedFiles: sourceFiles.length, findings, byKind, durationMs: Date.now() - start };
}
