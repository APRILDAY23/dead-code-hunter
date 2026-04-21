import { analyzeTodos } from 'dead-code-hunter-core';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

const KIND_COLOR: Record<string, (s: string) => string> = {
  TODO: chalk.blue,
  FIXME: chalk.red,
  HACK: chalk.yellow,
  XXX: chalk.red,
  BUG: chalk.red,
  TEMP: chalk.yellow,
  DEPRECATED: chalk.magenta,
};

export async function todosCommand(
  dir: string | undefined,
  options: { format?: string; output?: string; olderThan?: string; failOnAny?: boolean },
): Promise<void> {
  const rootDir = path.resolve(dir ?? process.cwd());
  const olderThanDays = options.olderThan ? parseInt(options.olderThan, 10) : undefined;

  process.stderr.write(chalk.dim(`Scanning for stale comments in ${rootDir}...\n`));
  const result = await analyzeTodos(rootDir, olderThanDays);

  let output: string;

  if (options.format === 'json') {
    output = JSON.stringify(result, null, 2) + '\n';
  } else {
    const lines: string[] = [];
    if (result.todos.length === 0) {
      lines.push(chalk.green('No stale comments found!'));
    } else {
      for (const item of result.todos) {
        const rel = path.relative(rootDir, item.file);
        const colorFn = KIND_COLOR[item.kind] ?? chalk.white;
        const age = item.daysSince !== undefined
          ? chalk.dim(` [${item.daysSince}d old${item.commitHash ? ` · ${item.commitHash}` : ''}]`)
          : '';
        const text = item.text ? chalk.dim(` - ${item.text}`) : '';
        lines.push(`${colorFn(item.kind)} ${chalk.cyan(rel)}:${chalk.yellow(String(item.line))}${age}${text}`);
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

  if (result.todos.length > 0) {
    process.stderr.write(chalk.yellow(`\nFound ${chalk.bold(String(result.todos.length))} comment(s) across ${result.scannedFiles} files - ${result.durationMs}ms\n`));
  }

  if (options.failOnAny && result.todos.length > 0) process.exit(1);
}
