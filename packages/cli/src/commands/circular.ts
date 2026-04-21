import { analyzeCircular } from 'dead-code-hunter-core';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

export async function circularCommand(
  dir: string | undefined,
  options: { format?: string; output?: string; failOnAny?: boolean },
): Promise<void> {
  const rootDir = path.resolve(dir ?? process.cwd());
  process.stderr.write(chalk.dim(`Scanning for circular imports in ${rootDir}...\n`));

  const result = await analyzeCircular(rootDir);

  let output: string;

  if (options.format === 'json') {
    output = JSON.stringify(result, null, 2) + '\n';
  } else {
    const lines: string[] = [];
    if (result.cycles.length === 0) {
      lines.push(chalk.green('No circular imports found!'));
    } else {
      let i = 1;
      for (const c of result.cycles) {
        lines.push(
          chalk.red(`Cycle ${i++}`) +
          chalk.dim(` (${c.length} files)`),
        );
        for (let j = 0; j < c.cycle.length; j++) {
          const arrow = j < c.cycle.length - 1 ? chalk.dim(' -> ') : chalk.red(' -> ') + chalk.yellow(c.cycle[0]);
          lines.push(`  ${chalk.cyan(c.cycle[j])}${arrow}`);
        }
        lines.push('');
      }

      lines.push(chalk.bold('Summary:'));
      lines.push(`  Circular cycles: ${result.cycles.length}`);
      lines.push(`  Scanned files:   ${result.scannedFiles}`);
      lines.push('');
      lines.push(chalk.dim('Tip: Break cycles by extracting shared logic into a new module both can import.'));
    }
    output = lines.join('\n') + '\n';
  }

  if (options.output) {
    fs.writeFileSync(path.resolve(options.output), output, 'utf-8');
    process.stderr.write(chalk.dim(`Report written to ${options.output}\n`));
  } else {
    process.stdout.write(output);
  }

  if (result.cycles.length > 0) {
    process.stderr.write(
      chalk.yellow(`\nFound ${chalk.bold(String(result.cycles.length))} circular import cycle(s) in ${result.scannedFiles} files - ${result.durationMs}ms\n`),
    );
  }

  if (options.failOnAny && result.cycles.length > 0) process.exit(1);
}
