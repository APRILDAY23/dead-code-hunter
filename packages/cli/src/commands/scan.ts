import {
  analyze,
  analyzeFiles,
  analyzeTodos,
  analyzeDupes,
  analyzeUnreachable,
  analyzeCatches,
  analyzeConfigKeys,
  analyzeDeps,
} from 'dead-code-hunter-core';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function bar(count: number, max: number, width = 20): string {
  if (max === 0) return chalk.dim('─'.repeat(width));
  const filled = Math.round((count / max) * width);
  return chalk.red('█'.repeat(filled)) + chalk.dim('░'.repeat(width - filled));
}

export async function scanCommand(
  dir: string | undefined,
  options: { format?: string; output?: string; failOnAny?: boolean },
): Promise<void> {
  const rootDir = path.resolve(dir ?? process.cwd());
  process.stderr.write(chalk.dim(`Running full scan of ${rootDir}...\n\n`));

  const [symbols, files, todos, dupes, unreachable, catches, config, deps] = await Promise.all([
    analyze(rootDir).catch(() => null),
    analyzeFiles(rootDir).catch(() => null),
    analyzeTodos(rootDir).catch(() => null),
    analyzeDupes(rootDir, 6).catch(() => null),
    analyzeUnreachable(rootDir).catch(() => null),
    analyzeCatches(rootDir).catch(() => null),
    analyzeConfigKeys(rootDir).catch(() => null),
    analyzeDeps(rootDir).catch(() => null),
  ]);

  const summary = {
    deadSymbols: symbols?.deadSymbols.length ?? 0,
    unusedFiles: files?.unusedFiles.length ?? 0,
    reclaimableBytes: files?.totalBytes ?? 0,
    staleComments: todos?.todos.length ?? 0,
    duplicateGroups: dupes?.duplicateGroups.length ?? 0,
    redundantLines: dupes?.totalWastedLines ?? 0,
    unreachableBlocks: unreachable?.unreachableCode.length ?? 0,
    errorHandlingIssues: catches?.emptyCatches.length ?? 0,
    unusedConfigKeys: config?.deadKeys.length ?? 0,
    unusedDeps: deps?.deadDependencies.length ?? 0,
    durationMs: Math.max(
      symbols?.durationMs ?? 0,
      files?.durationMs ?? 0,
      todos?.durationMs ?? 0,
      dupes?.durationMs ?? 0,
      unreachable?.durationMs ?? 0,
      catches?.durationMs ?? 0,
      config?.durationMs ?? 0,
      deps?.durationMs ?? 0,
    ),
  };

  const totalIssues =
    summary.deadSymbols + summary.unusedFiles + summary.staleComments +
    summary.duplicateGroups + summary.unreachableBlocks +
    summary.errorHandlingIssues + summary.unusedConfigKeys + summary.unusedDeps;

  let output: string;

  if (options.format === 'json') {
    output = JSON.stringify({ summary, details: { symbols, files, todos, dupes, unreachable, catches, config, deps } }, null, 2) + '\n';
  } else {
    const lines: string[] = [];

    lines.push(chalk.bold('Dead Code Hunter - Full Scan Report'));
    lines.push(chalk.dim('='.repeat(50)));
    lines.push('');

    const maxVal = Math.max(
      summary.deadSymbols, summary.unusedFiles, summary.staleComments,
      summary.duplicateGroups, summary.unreachableBlocks,
      summary.errorHandlingIssues, summary.unusedConfigKeys, summary.unusedDeps,
    );

    const rows: Array<[string, number, string]> = [
      ['Dead symbols',        summary.deadSymbols,          `run: dch analyze`],
      ['Unused files',        summary.unusedFiles,           `${humanSize(summary.reclaimableBytes)} reclaimable - run: dch files`],
      ['Stale comments',      summary.staleComments,         'run: dch todos'],
      ['Duplicate groups',    summary.duplicateGroups,       `~${summary.redundantLines} redundant lines - run: dch dupes`],
      ['Unreachable blocks',  summary.unreachableBlocks,     'run: dch unreachable'],
      ['Error handling',      summary.errorHandlingIssues,   'run: dch catches'],
      ['Unused config keys',  summary.unusedConfigKeys,      'run: dch config'],
      ['Unused deps',         summary.unusedDeps,            'run: dch deps'],
    ];

    for (const [label, count, hint] of rows) {
      const countStr = count === 0 ? chalk.green('  0') : chalk.red(String(count).padStart(3));
      const barStr = bar(count, maxVal);
      lines.push(`  ${label.padEnd(20)} ${countStr}  ${barStr}  ${count > 0 ? chalk.dim(hint) : chalk.green('clean')}`);
    }

    lines.push('');
    lines.push(chalk.dim('─'.repeat(50)));

    if (totalIssues === 0) {
      lines.push(chalk.green(chalk.bold('  All clean! No issues found.')));
    } else {
      lines.push(
        `  ${chalk.bold('Total issues:')} ${chalk.red(String(totalIssues))}  ` +
        chalk.dim(`scanned in ${summary.durationMs}ms`),
      );
      lines.push('');
      lines.push(chalk.dim('  Tip: run any command above for details, e.g. dch analyze'));
    }

    output = lines.join('\n') + '\n';
  }

  if (options.output) {
    fs.writeFileSync(path.resolve(options.output), output, 'utf-8');
    process.stderr.write(chalk.dim(`Report written to ${options.output}\n`));
  } else {
    process.stdout.write(output);
  }

  if (options.failOnAny && totalIssues > 0) process.exit(1);
}
