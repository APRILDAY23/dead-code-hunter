import type { AnalysisResult } from '../types';

const KIND_ICON: Record<string, string> = {
  function: 'fn',
  method: 'method',
  class: 'class',
  variable: 'var',
  interface: 'iface',
  type: 'type',
  enum: 'enum',
  struct: 'struct',
  trait: 'trait',
  module: 'mod',
};

export function consoleReport(result: AnalysisResult, rootDir: string): string {
  const lines: string[] = [];
  const rel = (f: string) => f.replace(rootDir, '').replace(/\\/g, '/').replace(/^\//, '');

  lines.push('');
  lines.push('Dead Code Hunter Results');
  lines.push('========================');
  lines.push(`Scanned: ${result.scannedFiles} files  |  Dead symbols: ${result.deadSymbols.length}  |  Time: ${result.durationMs}ms`);

  // Language detection summary
  if (result.detectedLanguages.length > 0) {
    const langSummary = result.detectedLanguages
      .map(l => `${capitalize(l.language)} (${l.fileCount} file${l.fileCount === 1 ? '' : 's'})`)
      .join(', ');
    lines.push(`Languages detected: ${langSummary}`);
  }

  lines.push('');

  if (result.deadSymbols.length === 0) {
    lines.push('No dead code found!');
    return lines.join('\n');
  }

  // Cleanup potential block
  lines.push('Cleanup potential:');
  lines.push(`  ~${result.cleanup.estimatedLines} lines of dead code across ${result.byFile.size} file${result.byFile.size === 1 ? '' : 's'}`);

  const kindParts = Object.entries(result.cleanup.byKind)
    .sort((a, b) => b[1] - a[1])
    .map(([kind, count]) => `${capitalize(kind)}s: ${count}`)
    .join('   ');
  if (kindParts) lines.push(`  ${kindParts}`);
  lines.push('');

  // Dead symbols grouped by file
  for (const [file, syms] of result.byFile) {
    lines.push(`  ${rel(file)}`);
    for (const { definition, reason } of syms) {
      const icon = KIND_ICON[definition.kind] ?? definition.kind;
      lines.push(`    [${icon}]  ${padEnd(definition.name, 28)} (line ${definition.line})  — ${reason}`);
    }
    lines.push('');
  }

  // Per-language breakdown
  if (result.detectedLanguages.some(l => l.deadCount > 0)) {
    lines.push('Dead code by language:');
    for (const lang of result.detectedLanguages) {
      if (lang.deadCount === 0) continue;
      const pct = lang.definitionCount > 0
        ? Math.round((lang.deadCount / lang.definitionCount) * 100)
        : 0;
      lines.push(`  ${padEnd(capitalize(lang.language), 14)}  ${lang.deadCount} dead / ${lang.definitionCount} total symbols  (${pct}%)`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function padEnd(s: string, len: number): string {
  return s.length >= len ? s : s + ' '.repeat(len - s.length);
}
