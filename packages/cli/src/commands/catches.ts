import { analyzeCatches } from 'dead-code-hunter-core';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

export async function catchesCommand(
  dir: string | undefined,
  options: { format?: string; output?: string; failOnAny?: boolean },
): Promise<void> {
  const rootDir = path.resolve(dir ?? process.cwd());
  process.stderr.write(chalk.dim(`Scanning for empty catch blocks in ${rootDir}...\n`));

  const result = await analyzeCatches(rootDir);

  let output: string;

  if (options.format === 'json') {
    output = JSON.stringify(result, null, 2) + '\n';
  } else {
    const lines: string[] = [];
    if (result.emptyCatches.length === 0) {
      lines.push(chalk.green('No empty catch blocks found!'));
    } else {
      for (const c of result.emptyCatches) {
        const rel = path.relative(rootDir, c.file);
        const label = c.kind === 'swallowed'
          ? chalk.yellow('swallowed')
          : chalk.red('empty');
        lines.push(`${label} ${chalk.cyan(rel)}:${chalk.yellow(String(c.line))}`);
        lines.push(chalk.dim(`  ${c.snippet}`));
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
    process.stderr.write(
      chalk.yellow(`\nFound ${chalk.bold(String(result.emptyCatches.length))} empty/swallowed catch block(s) - ${result.durationMs}ms\n`),
    );
  }

  if (options.failOnAny && result.emptyCatches.length > 0) process.exit(1);
}
