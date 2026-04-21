import { analyzeCatches, type CatchSeverity } from 'dead-code-hunter-core';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

const SEV_COLOR: Record<CatchSeverity, (s: string) => string> = {
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.blue,
};

const SEV_ICON: Record<CatchSeverity, string> = {
  error: '✖',
  warning: '⚠',
  info: 'ℹ',
};

export async function catchesCommand(
  dir: string | undefined,
  options: { format?: string; output?: string; failOnAny?: boolean },
): Promise<void> {
  const rootDir = path.resolve(dir ?? process.cwd());
  process.stderr.write(chalk.dim(`Scanning for problematic error handling in ${rootDir}...\n`));

  const result = await analyzeCatches(rootDir);

  let output: string;

  if (options.format === 'json') {
    output = JSON.stringify(result, null, 2) + '\n';
  } else {
    const lines: string[] = [];
    if (result.emptyCatches.length === 0) {
      lines.push(chalk.green('No problematic error handling found!'));
    } else {
      for (const c of result.emptyCatches) {
        const rel = path.relative(rootDir, c.file);
        const colorFn = SEV_COLOR[c.severity];
        lines.push(
          `${colorFn(SEV_ICON[c.severity])} ${colorFn(c.kind.padEnd(10))} ${chalk.cyan(rel)}:${chalk.yellow(String(c.line))}`,
        );
        lines.push(chalk.dim(`  ${c.snippet}`));
        lines.push(chalk.dim(`  hint: ${c.suggestion}`));
      }
      lines.push('');
      lines.push(chalk.bold('Severity breakdown:'));
      for (const [sev, count] of Object.entries(result.bySeverity) as [CatchSeverity, number][]) {
        if (count > 0) lines.push(`  ${SEV_COLOR[sev]((sev + ':').padEnd(10))} ${count}`);
      }
    }
    output = lines.join('\n') + '\n';
  }

  if (options.output) {
    fs.writeFileSync(path.resolve(options.output), output, 'utf-8');
    process.stderr.write(chalk.dim(`Report written to ${options.output}\n`));
  } else {
    process.stdout.write(output);
  }

  if (result.emptyCatches.length > 0) {
    process.stderr.write(chalk.yellow(
      `\nFound ${chalk.bold(String(result.emptyCatches.length))} issue(s): ` +
      `${result.bySeverity.error} error, ${result.bySeverity.warning} warning, ${result.bySeverity.info} info - ${result.durationMs}ms\n`,
    ));
  }

  if (options.failOnAny && result.emptyCatches.length > 0) process.exit(1);
}
