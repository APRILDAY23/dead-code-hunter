import { analyzeSecrets } from 'dead-code-hunter-core';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

const CONF_COLOR = {
  high:   chalk.red,
  medium: chalk.yellow,
  low:    chalk.dim,
};

const CONF_ICON = {
  high:   '!!',
  medium: '⚠ ',
  low:    '· ',
};

export async function secretsCommand(
  dir: string | undefined,
  options: { format?: string; output?: string; failOnAny?: boolean },
): Promise<void> {
  const rootDir = path.resolve(dir ?? process.cwd());
  process.stderr.write(chalk.dim(`Scanning for hardcoded secrets in ${rootDir}...\n`));

  const result = await analyzeSecrets(rootDir);

  let output: string;

  if (options.format === 'json') {
    output = JSON.stringify(result, null, 2) + '\n';
  } else {
    const lines: string[] = [];
    if (result.findings.length === 0) {
      lines.push(chalk.green('No hardcoded secrets detected!'));
    } else {
      const high = result.findings.filter(f => f.confidence === 'high');
      const medium = result.findings.filter(f => f.confidence === 'medium');
      const low = result.findings.filter(f => f.confidence === 'low');

      for (const [label, group] of [['High confidence', high], ['Medium confidence', medium], ['Low confidence', low]] as const) {
        if ((group as typeof result.findings).length === 0) continue;
        lines.push(chalk.bold(label + ':'));
        for (const f of group as typeof result.findings) {
          const rel = path.relative(rootDir, f.file);
          const colorFn = CONF_COLOR[f.confidence];
          lines.push(
            `  ${colorFn(CONF_ICON[f.confidence])} ${chalk.cyan(rel)}:${chalk.yellow(String(f.line))}  ${chalk.bold(f.kind)}`,
          );
          lines.push(chalk.dim(`     ${f.snippet}`));
        }
        lines.push('');
      }

      lines.push(chalk.bold('By type:'));
      for (const [kind, count] of Object.entries(result.byKind).sort((a, b) => b[1] - a[1])) {
        lines.push(`  ${kind.padEnd(24)} ${count}`);
      }

      lines.push('');
      lines.push(chalk.dim('Note: Values are redacted in output. Review originals carefully.'));
      lines.push(chalk.dim('Tip:  Move secrets to environment variables and add to .gitignore.'));
    }
    output = lines.join('\n') + '\n';
  }

  if (options.output) {
    fs.writeFileSync(path.resolve(options.output), output, 'utf-8');
    process.stderr.write(chalk.dim(`Report written to ${options.output}\n`));
  } else {
    process.stdout.write(output);
  }

  if (result.findings.length > 0) {
    const high = result.findings.filter(f => f.confidence === 'high').length;
    process.stderr.write(
      chalk.red(
        `\nFound ${chalk.bold(String(result.findings.length))} potential secret(s)` +
        (high > 0 ? ` (${chalk.bold(String(high))} HIGH confidence)` : '') +
        ` in ${result.scannedFiles} files - ${result.durationMs}ms\n`,
      ),
    );
  }

  if (options.failOnAny && result.findings.length > 0) process.exit(1);
}
