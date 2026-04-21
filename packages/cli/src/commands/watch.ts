import { analyze, consoleReport } from 'dead-code-hunter-core';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

export async function watchCommand(dir: string | undefined): Promise<void> {
  const rootDir = path.resolve(dir ?? process.cwd());

  async function run(): Promise<void> {
    process.stdout.write('\x1Bc'); // clear terminal
    process.stderr.write(chalk.dim(`[${new Date().toLocaleTimeString()}] Scanning ${rootDir}...\n`));
    try {
      const result = await analyze(rootDir);
      process.stdout.write(consoleReport(result, rootDir));
      if (result.deadSymbols.length > 0) {
        process.stderr.write(chalk.yellow(`\nFound ${chalk.bold(String(result.deadSymbols.length))} dead symbol(s) in ${result.scannedFiles} files — ${result.durationMs}ms\n`));
      } else {
        process.stderr.write(chalk.green('\nNo dead code found!\n'));
      }
    } catch (err) {
      process.stderr.write(chalk.red(`Analysis error: ${err}\n`));
    }
    process.stderr.write(chalk.dim('\nWatching for changes... (Ctrl+C to stop)\n'));
  }

  await run();

  let debounce: ReturnType<typeof setTimeout> | null = null;

  fs.watch(rootDir, { recursive: true }, (_event, filename) => {
    if (!filename) return;
    const f = filename.replace(/\\/g, '/');
    if (f.includes('node_modules') || f.includes('.git') || f.includes('/dist/') || f.includes('/build/')) return;
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(run, 500);
  });
}
