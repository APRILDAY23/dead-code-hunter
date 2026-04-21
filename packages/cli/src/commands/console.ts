import { analyzeConsole } from 'dead-code-hunter-core';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

const KIND_COLOR: Record<string, (s: string) => string> = {
  log:   chalk.blue,
  warn:  chalk.yellow,
  debug: chalk.magenta,
  info:  chalk.cyan,
  error: chalk.red,
  print: chalk.white,
  trace: chalk.dim,
  dir:   chalk.green,
};

export async function consoleCommand(
  dir: string | undefined,
  options: { format?: string; output?: string; includeTests?: boolean; failOnAny?: boolean },
): Promise<void> {
  const rootDir = path.resolve(dir ?? process.cwd());
  const skipTests = !options.includeTests;
  process.stderr.write(chalk.dim(`Scanning for debug statements in ${rootDir}...\n`));

  const result = await analyzeConsole(rootDir, skipTests);

  let output: string;

  if (options.format === 'json') {
    output = JSON.stringify(result, null, 2) + '\n';
  } else {
    const lines: string[] = [];
    if (result.statements.length === 0) {
      lines.push(chalk.green('No debug statements found!'));
    } else {
      // Group by file
      const byFile = new Map<string, typeof result.statements>();
      for (const s of result.statements) {
        const list = byFile.get(s.file) ?? [];
        list.push(s);
        byFile.set(s.file, list);
      }

      for (const [file, stmts] of byFile) {
        const rel = path.relative(rootDir, file);
        lines.push(chalk.bold(chalk.cyan(rel)) + chalk.dim(` (${stmts.length})`));
        for (const s of stmts) {
          const colorFn = KIND_COLOR[s.kind] ?? chalk.white;
          lines.push(
            `  ${chalk.yellow(String(s.line).padStart(4))}  ${colorFn(s.kind.padEnd(6))}  ${chalk.dim(s.snippet)}`,
          );
        }
        lines.push('');
      }

      lines.push(chalk.bold('By type:'));
      for (const [kind, count] of Object.entries(result.byKind).sort((a, b) => b[1] - a[1])) {
        const colorFn = KIND_COLOR[kind] ?? chalk.white;
        lines.push(`  ${colorFn(kind.padEnd(10))} ${count}`);
      }

      if (Object.keys(result.byLanguage).length > 1) {
        lines.push('');
        lines.push(chalk.bold('By language:'));
        for (const [lang, count] of Object.entries(result.byLanguage).sort((a, b) => b[1] - a[1])) {
          lines.push(`  ${lang.padEnd(14)} ${count}`);
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

  if (result.statements.length > 0) {
    process.stderr.write(
      chalk.yellow(`\nFound ${chalk.bold(String(result.statements.length))} debug statement(s) in ${result.scannedFiles} files - ${result.durationMs}ms\n`),
    );
  }

  if (options.failOnAny && result.statements.length > 0) process.exit(1);
}
