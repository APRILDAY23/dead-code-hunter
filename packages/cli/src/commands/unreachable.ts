import { analyzeUnreachable } from 'dead-code-hunter-core';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

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
      for (const block of result.unreachableCode) {
        const rel = path.relative(rootDir, block.file);
        lines.push(
          chalk.red('unreachable') + ' ' + chalk.cyan(rel) + ':' + chalk.yellow(String(block.unreachableLine)),
        );
        lines.push(chalk.dim(`  after: ${block.terminatorText} (line ${block.terminatorLine})`));
        lines.push(chalk.dim(`  dead:  ${block.unreachableText}`));
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

  if (result.unreachableCode.length > 0) {
    process.stderr.write(
      chalk.yellow(`\nFound ${chalk.bold(String(result.unreachableCode.length))} unreachable block(s) across ${result.scannedFiles} files - ${result.durationMs}ms\n`),
    );
  }

  if (options.failOnAny && result.unreachableCode.length > 0) process.exit(1);
}
