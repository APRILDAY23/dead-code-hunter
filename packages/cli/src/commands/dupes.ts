import { analyzeDupes } from 'dead-code-hunter-core';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

export async function dupesCommand(
  dir: string | undefined,
  options: { format?: string; output?: string; minLines?: string; failOnAny?: boolean },
): Promise<void> {
  const rootDir = path.resolve(dir ?? process.cwd());
  const minLines = options.minLines ? parseInt(options.minLines, 10) : 6;

  process.stderr.write(chalk.dim(`Scanning for duplicate code in ${rootDir}...\n`));
  const result = await analyzeDupes(rootDir, minLines);

  let output: string;

  if (options.format === 'json') {
    output = JSON.stringify(result, null, 2) + '\n';
  } else {
    const lines: string[] = [];
    if (result.duplicateGroups.length === 0) {
      lines.push(chalk.green('No duplicate code found!'));
    } else {
      for (const group of result.duplicateGroups) {
        lines.push(chalk.yellow(`Duplicate block (${group.lineCount} lines, ${group.occurrences.length} copies):`));
        for (const occ of group.occurrences) {
          const rel = path.relative(rootDir, occ.file);
          lines.push(
            `  ${chalk.dim('-')} ${chalk.bold(occ.name)} @ ${chalk.cyan(rel)}:${chalk.yellow(String(occ.startLine))}-${chalk.yellow(String(occ.endLine))}`,
          );
        }
        lines.push('');
      }
    }
    output = lines.join('\n');
  }

  if (options.output) {
    fs.writeFileSync(path.resolve(options.output), output, 'utf-8');
    process.stderr.write(chalk.dim(`Report written to ${options.output}\n`));
  } else {
    process.stdout.write(output);
  }

  if (result.duplicateGroups.length > 0) {
    const totalWasted = result.duplicateGroups.reduce((s, g) => s + g.lineCount * (g.occurrences.length - 1), 0);
    process.stderr.write(
      chalk.yellow(`\nFound ${chalk.bold(String(result.duplicateGroups.length))} duplicate group(s) - ~${totalWasted} redundant lines - ${result.durationMs}ms\n`),
    );
  }

  if (options.failOnAny && result.duplicateGroups.length > 0) process.exit(1);
}
