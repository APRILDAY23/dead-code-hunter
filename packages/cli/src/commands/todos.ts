import { analyzeTodos, type TodoKind } from 'dead-code-hunter-core';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

const KIND_COLOR: Record<TodoKind, (s: string) => string> = {
  TODO: chalk.blue,
  FIXME: chalk.red,
  HACK: chalk.yellow,
  XXX: chalk.red,
  BUG: chalk.redBright,
  TEMP: chalk.yellow,
  DEPRECATED: chalk.magenta,
};

export async function todosCommand(
  dir: string | undefined,
  options: { format?: string; output?: string; olderThan?: string; author?: string; failOnAny?: boolean },
): Promise<void> {
  const rootDir = path.resolve(dir ?? process.cwd());
  const olderThanDays = options.olderThan ? parseInt(options.olderThan, 10) : undefined;
  process.stderr.write(chalk.dim(`Scanning for stale comments in ${rootDir}...\n`));

  const result = await analyzeTodos(rootDir, olderThanDays);
  const todos = options.author
    ? result.todos.filter(t => t.author?.toLowerCase().includes(options.author!.toLowerCase()))
    : result.todos;

  let output: string;

  if (options.format === 'json') {
    output = JSON.stringify({ ...result, todos }, null, 2) + '\n';
  } else {
    const lines: string[] = [];
    if (todos.length === 0) {
      lines.push(chalk.green('No stale comments found!'));
    } else {
      let lastKind = '';
      for (const item of todos) {
        if (item.kind !== lastKind) {
          lines.push('');
          lines.push(chalk.bold(`${KIND_COLOR[item.kind](item.kind)} (${result.byKind[item.kind] ?? 0})`));
          lastKind = item.kind;
        }
        const rel = path.relative(rootDir, item.file);
        const age = item.daysSince !== undefined
          ? chalk.dim(` ${item.daysSince}d old`)
          : '';
        const author = item.author ? chalk.dim(` by ${item.author}`) : '';
        const hash = item.commitHash ? chalk.dim(` [${item.commitHash}]`) : '';
        const issue = item.issueRef ? chalk.cyan(` ${item.issueRef}`) : '';
        lines.push(`  ${chalk.cyan(rel)}:${chalk.yellow(String(item.line))}${age}${author}${hash}${issue}`);
        if (item.text) lines.push(`  ${chalk.dim(item.text)}`);
      }

      lines.push('');
      lines.push(chalk.bold('Summary:'));
      for (const [kind, count] of Object.entries(result.byKind)) {
        lines.push(`  ${KIND_COLOR[kind as TodoKind](kind.padEnd(12))} ${count}`);
      }
      if (Object.keys(result.byAuthor).length > 0) {
        lines.push('');
        lines.push(chalk.bold('By author:'));
        for (const [author, count] of Object.entries(result.byAuthor).sort((a, b) => b[1] - a[1]).slice(0, 5)) {
          lines.push(`  ${author.padEnd(25)} ${count}`);
        }
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

  if (todos.length > 0) {
    process.stderr.write(chalk.yellow(`\nFound ${chalk.bold(String(todos.length))} comment(s) in ${result.scannedFiles} files - ${result.durationMs}ms\n`));
  }

  if (options.failOnAny && todos.length > 0) process.exit(1);
}
