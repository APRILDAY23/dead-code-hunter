import { analyzeUnreachable } from 'dead-code-hunter-core';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

const SEV_COLOR = { error: chalk.red, warning: chalk.yellow };
const SEV_ICON = { error: '✖', warning: '⚠' };

export async function unreachableCommand(
  dir: string | undefined,
  options: { format?: string; output?: string; failOnAny?: boolean },
): Promise<void> {
  const rootDir = path.resolve(dir ?? process.cwd());
  process.stderr.write(chalk.dim(`Scanning for unreachable code in ${rootDir}...\n`));

  const result = await analyzeUnreachable(rootDir);

  let output: string;

  if (options.format === 'json') {
    output = JSON.stringify(result, null, 2) + '\n';
  } else {
    const lines: string[] = [];
    if (result.unreachableCode.length === 0) {
      lines.push(chalk.green('No unreachable code found!'));
    } else {
      const errors = result.unreachableCode.filter(b => b.severity === 'error');
      const warnings = result.unreachableCode.filter(b => b.severity === 'warning');

      for (const block of result.unreachableCode) {
        const rel = path.relative(rootDir, block.file);
        const colorFn = SEV_COLOR[block.severity];
        const icon = SEV_ICON[block.severity];

        lines.push(
          `${colorFn(icon)} ${chalk.cyan(rel)}:${chalk.yellow(String(block.unreachableLine))}-${chalk.yellow(String(block.unreachableEnd))}`,
        );
        lines.push(chalk.dim(`  terminator (line ${block.terminatorLine}): ${block.terminatorText}`));
        lines.push(chalk.dim('  dead code:'));
        for (const dl of block.unreachableLines) {
          lines.push(chalk.dim(`    ${dl}`));
        }
        lines.push('');
      }

      lines.push(chalk.bold('Severity breakdown:'));
      if (errors.length > 0) lines.push(`  ${chalk.red(('error:').padEnd(10))} ${errors.length}`);
      if (warnings.length > 0) lines.push(`  ${chalk.yellow(('warning:').padEnd(10))} ${warnings.length}`);
    }
    output = lines.join('\n') + '\n';
  }

  if (options.output) {
    fs.writeFileSync(path.resolve(options.output), output, 'utf-8');
    process.stderr.write(chalk.dim(`Report written to ${options.output}\n`));
  } else {
    process.stdout.write(output);
  }

  if (result.unreachableCode.length > 0) {
    process.stderr.write(
      chalk.yellow(`\nFound ${chalk.bold(String(result.unreachableCode.length))} unreachable block(s) across ${result.scannedFiles} files - ${result.durationMs}ms\n`),
    );
  }

  if (options.failOnAny && result.unreachableCode.length > 0) process.exit(1);
}
