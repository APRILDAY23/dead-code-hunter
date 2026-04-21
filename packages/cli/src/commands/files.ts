import { analyzeFiles } from 'dead-code-hunter-core';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function formatAge(date: Date): string {
  const days = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return '1d ago';
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
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
      const barrels = result.unusedFiles.filter(f => f.isBarrel);
      const dead = result.unusedFiles.filter(f => !f.isBarrel);

      if (dead.length > 0) {
        lines.push(chalk.bold('Unused files:'));
        for (const f of dead) {
          const rel = path.relative(rootDir, f.file);
          const age = formatAge(new Date(f.lastModified));
          lines.push(
            `  ${chalk.red('unused')} ${chalk.cyan(rel)} ${chalk.dim(`${humanSize(f.sizeBytes)} - ${age}`)}`,
          );
          lines.push(chalk.dim(`    reason: ${f.reason}`));
        }
      }

      if (barrels.length > 0) {
        if (dead.length > 0) lines.push('');
        lines.push(chalk.bold('Barrel files (re-export only, nothing imports them):'));
        for (const f of barrels) {
          const rel = path.relative(rootDir, f.file);
          lines.push(
            `  ${chalk.yellow('barrel')} ${chalk.cyan(rel)} ${chalk.dim(humanSize(f.sizeBytes))}`,
          );
        }
      }

      lines.push('');
      lines.push(chalk.bold('Summary:'));
      lines.push(`  Total unused: ${result.unusedFiles.length} file(s)`);
      lines.push(`  Reclaimable:  ${humanSize(result.totalBytes)}`);
      lines.push(`  Scanned:      ${result.scannedFiles} source file(s)`);
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
    process.stderr.write(
      chalk.yellow(`\nFound ${chalk.bold(String(result.unusedFiles.length))} unused file(s) - ${humanSize(result.totalBytes)} recoverable - ${result.durationMs}ms\n`),
    );
  }

  if (options.failOnDead && result.unusedFiles.length > 0) process.exit(1);
}
