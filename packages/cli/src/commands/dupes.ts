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
      let i = 1;
      for (const group of result.duplicateGroups) {
        const wastedLines = group.lineCount * (group.occurrences.length - 1);
        lines.push(
          chalk.bold(`[${i++}] Duplicate block`) +
          chalk.dim(` - ${group.lineCount} lines x ${group.occurrences.length} copies = ${wastedLines} redundant lines`),
        );

        for (const occ of group.occurrences) {
          const rel = path.relative(rootDir, occ.file);
          lines.push(
            `  ${chalk.dim('at')} ${chalk.bold(occ.name)} ${chalk.cyan(rel)}:${chalk.yellow(String(occ.startLine))}-${chalk.yellow(String(occ.endLine))}`,
          );
        }

        if (group.snippet) {
          lines.push(chalk.dim('  Preview:'));
          for (const snippetLine of group.snippet.split('\n').slice(0, 4)) {
            lines.push(chalk.dim(`    ${snippetLine}`));
          }
        }

        if (group.suggestedLocation) {
          const relLoc = path.relative(rootDir, group.suggestedLocation);
          lines.push(chalk.blue(`  Suggestion: extract to ${relLoc}/`));
        }

        lines.push('');
      }

      lines.push(chalk.bold('Summary:'));
      lines.push(`  Duplicate groups:  ${result.duplicateGroups.length}`);
      lines.push(`  Redundant lines:   ~${result.totalWastedLines}`);
      lines.push(`  Scanned files:     ${result.scannedFiles}`);
    }
    output = lines.join('\n') + '\n';
  }

  if (options.output) {
    fs.writeFileSync(path.resolve(options.output), output, 'utf-8');
    process.stderr.write(chalk.dim(`Report written to ${options.output}\n`));
  } else {
    process.stdout.write(output);
  }

  if (result.duplicateGroups.length > 0) {
    process.stderr.write(
      chalk.yellow(`\nFound ${chalk.bold(String(result.duplicateGroups.length))} duplicate group(s) - ~${result.totalWastedLines} redundant lines - ${result.durationMs}ms\n`),
    );
  }

  if (options.failOnAny && result.duplicateGroups.length > 0) process.exit(1);
}
