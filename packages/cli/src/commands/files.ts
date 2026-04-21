import { analyzeFiles } from 'dead-code-hunter-core';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

export async function filesCommand(
  dir: string | undefined,
  options: { format?: string; output?: string; failOnDead?: boolean },
): Promise<void> {
  const rootDir = path.resolve(dir ?? process.cwd());
  process.stderr.write(chalk.dim(`Scanning for unused files in ${rootDir}...\n`));

  const result = await analyzeFiles(rootDir);

  let output: string;

  if (options.format === 'json') {
    output = JSON.stringify(result, null, 2) + '\n';
  } else {
    const lines: string[] = [];
    if (result.unusedFiles.length === 0) {
      lines.push(chalk.green('No unused files found!'));
    } else {
      for (const f of result.unusedFiles) {
        const rel = path.relative(rootDir, f.file);
        lines.push(
          chalk.red('unused') + ' ' + chalk.cyan(rel) +
          chalk.dim(` (${humanSize(f.sizeBytes)})`),
        );
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

  if (result.unusedFiles.length > 0) {
    const totalBytes = result.unusedFiles.reduce((s, f) => s + f.sizeBytes, 0);
    process.stderr.write(
      chalk.yellow(`\nFound ${chalk.bold(String(result.unusedFiles.length))} unused file(s) — ${humanSize(totalBytes)} recoverable — ${result.durationMs}ms\n`),
    );
  }

  if (options.failOnDead && result.unusedFiles.length > 0) process.exit(1);
}
