#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import { analyze, consoleReport, jsonReport, htmlReport, sarifReport } from 'dead-code-hunter-core';
import { fixCommand } from './commands/fix';
import { watchCommand } from './commands/watch';
import { depsCommand } from './commands/deps';
import { baselineCommand } from './commands/baseline';
import { filesCommand } from './commands/files';
import { todosCommand } from './commands/todos';
import { dupesCommand } from './commands/dupes';
import { unreachableCommand } from './commands/unreachable';
import { catchesCommand } from './commands/catches';
import { configKeysCommand } from './commands/configkeys';
import { scanCommand } from './commands/scan';
import { consoleCommand } from './commands/console';
import { complexityCommand } from './commands/complexity';
import { circularCommand } from './commands/circular';
import { secretsCommand } from './commands/secrets';

const program = new Command();

program
  .name('dch')
  .description('Dead Code Hunter - find unused code across your entire project')
  .version('1.0.0');

// ── analyze ───────────────────────────────────────────────────────────────────

program
  .command('analyze [dir]')
  .description('Scan for dead symbols - functions, classes, variables')
  .option('-f, --format <format>', 'Output format: text | json | html | sarif', 'text')
  .option('-o, --output <file>', 'Write results to a file instead of stdout')
  .option('--fail-on-dead', 'Exit with code 1 if dead code is found (for CI)')
  .option('--min-confidence <n>', 'Minimum confidence threshold 0-1', '0.8')
  .option('--languages <langs>', 'Comma-separated list of languages to check')
  .option('--dead-since <duration>', 'Only show symbols untouched for this long (e.g. 30d, 2w, 3m)')
  .action(async (dir: string | undefined, options) => {
    const rootDir = path.resolve(dir ?? process.cwd());
    if (!fs.existsSync(rootDir)) { console.error(chalk.red(`Directory not found: ${rootDir}`)); process.exit(1); }
    console.error(chalk.dim(`Scanning ${rootDir}...`));
    try {
      const extraConfig: Record<string, unknown> = {};
      if (options.languages) extraConfig.languages = (options.languages as string).split(',').map((s: string) => s.trim());
      if (options.deadSince) extraConfig.deadSince = options.deadSince;
      const result = await analyze(rootDir, extraConfig as never);
      let output: string;
      switch (options.format) {
        case 'json': output = jsonReport(result); break;
        case 'html': output = htmlReport(result, rootDir); break;
        case 'sarif': output = sarifReport(result); break;
        default:
          output = consoleReport(result, rootDir);
          process.stderr.write(result.deadSymbols.length > 0
            ? chalk.yellow(`\nFound ${chalk.bold(String(result.deadSymbols.length))} dead symbol(s) in ${result.scannedFiles} files - ${result.durationMs}ms\n`)
            : chalk.green('\nNo dead code found!\n'));
      }
      if (options.output) { fs.writeFileSync(path.resolve(options.output), output, 'utf-8'); console.error(chalk.dim(`Report written to ${options.output}`)); }
      else process.stdout.write(output);
      if (options.failOnDead && result.deadSymbols.length > 0) process.exit(1);
    } catch (err) { console.error(chalk.red('Analysis failed:'), err); process.exit(1); }
  });

// ── files ─────────────────────────────────────────────────────────────────────

program
  .command('files [dir]')
  .description('Find source files that are never imported by anything')
  .option('-f, --format <format>', 'Output format: text | json', 'text')
  .option('-o, --output <file>', 'Write results to a file')
  .option('--fail-on-dead', 'Exit with code 1 if unused files are found')
  .action(async (dir, options) => {
    try { await filesCommand(dir, options); }
    catch (err) { console.error(chalk.red('Files check failed:'), err); process.exit(1); }
  });

// ── todos ─────────────────────────────────────────────────────────────────────

program
  .command('todos [dir]')
  .description('Find stale TODO / FIXME / HACK comments with their git age')
  .option('-f, --format <format>', 'Output format: text | json', 'text')
  .option('-o, --output <file>', 'Write results to a file')
  .option('--older-than <days>', 'Only show comments older than N days')
  .option('--author <name>', 'Filter by author name or email (partial match)')
  .option('--fail-on-any', 'Exit with code 1 if any stale comments are found')
  .action(async (dir, options) => {
    try { await todosCommand(dir, options); }
    catch (err) { console.error(chalk.red('Todos check failed:'), err); process.exit(1); }
  });

// ── dupes ─────────────────────────────────────────────────────────────────────

program
  .command('dupes [dir]')
  .description('Find duplicate or near-identical function bodies')
  .option('-f, --format <format>', 'Output format: text | json', 'text')
  .option('-o, --output <file>', 'Write results to a file')
  .option('--min-lines <n>', 'Minimum function length to compare (default: 6)', '6')
  .option('--fail-on-any', 'Exit with code 1 if duplicates are found')
  .action(async (dir, options) => {
    try { await dupesCommand(dir, options); }
    catch (err) { console.error(chalk.red('Dupes check failed:'), err); process.exit(1); }
  });

// ── unreachable ───────────────────────────────────────────────────────────────

program
  .command('unreachable [dir]')
  .description('Find code written after return / throw that can never execute')
  .option('-f, --format <format>', 'Output format: text | json', 'text')
  .option('-o, --output <file>', 'Write results to a file')
  .option('--fail-on-any', 'Exit with code 1 if unreachable code is found')
  .action(async (dir, options) => {
    try { await unreachableCommand(dir, options); }
    catch (err) { console.error(chalk.red('Unreachable check failed:'), err); process.exit(1); }
  });

// ── catches ───────────────────────────────────────────────────────────────────

program
  .command('catches [dir]')
  .description('Find empty catch blocks that silently swallow errors')
  .option('-f, --format <format>', 'Output format: text | json', 'text')
  .option('-o, --output <file>', 'Write results to a file')
  .option('--fail-on-any', 'Exit with code 1 if empty catches are found')
  .action(async (dir, options) => {
    try { await catchesCommand(dir, options); }
    catch (err) { console.error(chalk.red('Catches check failed:'), err); process.exit(1); }
  });

// ── config ────────────────────────────────────────────────────────────────────

program
  .command('config [dir]')
  .description('Find .env / config.json keys that are never used in source code')
  .option('-f, --format <format>', 'Output format: text | json', 'text')
  .option('-o, --output <file>', 'Write results to a file')
  .option('--fail-on-dead', 'Exit with code 1 if unused keys are found')
  .action(async (dir, options) => {
    try { await configKeysCommand(dir, options); }
    catch (err) { console.error(chalk.red('Config check failed:'), err); process.exit(1); }
  });

// ── fix ───────────────────────────────────────────────────────────────────────

program
  .command('fix [dir]')
  .description('Interactively delete or suppress dead code symbols')
  .action(async (dir) => {
    try { await fixCommand(dir); }
    catch (err) { console.error(chalk.red('Fix failed:'), err); process.exit(1); }
  });

// ── watch ─────────────────────────────────────────────────────────────────────

program
  .command('watch [dir]')
  .description('Re-analyze automatically on every file save')
  .action(async (dir) => {
    try { await watchCommand(dir); }
    catch (err) { console.error(chalk.red('Watch failed:'), err); process.exit(1); }
  });

// ── deps ──────────────────────────────────────────────────────────────────────

program
  .command('deps [dir]')
  .description('Detect unused dependencies in package manifests')
  .option('-f, --format <format>', 'Output format: text | json', 'text')
  .option('-o, --output <file>', 'Write results to a file')
  .option('--fail-on-dead', 'Exit with code 1 if unused deps are found')
  .action(async (dir, options) => {
    try { await depsCommand(dir, options); }
    catch (err) { console.error(chalk.red('Deps check failed:'), err); process.exit(1); }
  });

// ── baseline ──────────────────────────────────────────────────────────────────

program
  .command('baseline <subcommand> [dir]')
  .description('Baseline management: save | diff | check')
  .option('--fail-on-new', 'Exit with code 1 if new dead symbols are found')
  .addHelpText('after', `
Subcommands:
  save   Record current dead symbols as the baseline
  diff   Show dead symbols added since the baseline
  check  Like diff but exits with code 1 if new dead symbols exist`)
  .action(async (subcommand, dir, options) => {
    try { await baselineCommand(subcommand, dir, options); }
    catch (err) { console.error(chalk.red('Baseline failed:'), err); process.exit(1); }
  });

// ── console ───────────────────────────────────────────────────────────────────

program
  .command('console [dir]')
  .description('Find console.log / print / fmt.Println debug statements left in source code')
  .option('-f, --format <format>', 'Output format: text | json', 'text')
  .option('-o, --output <file>', 'Write results to a file')
  .option('--include-tests', 'Include test files (excluded by default)')
  .option('--fail-on-any', 'Exit with code 1 if any debug statements are found')
  .action(async (dir, options) => {
    try { await consoleCommand(dir, options); }
    catch (err) { console.error(chalk.red('Console check failed:'), err); process.exit(1); }
  });

// ── complexity ────────────────────────────────────────────────────────────────

program
  .command('complexity [dir]')
  .description('Find functions with high cyclomatic complexity that are hard to maintain')
  .option('-f, --format <format>', 'Output format: text | json', 'text')
  .option('-o, --output <file>', 'Write results to a file')
  .option('--threshold <n>', 'Minimum complexity to report (default: 5)', '5')
  .option('--fail-on-high', 'Exit with code 1 if any high/critical functions are found')
  .action(async (dir, options) => {
    try { await complexityCommand(dir, options); }
    catch (err) { console.error(chalk.red('Complexity check failed:'), err); process.exit(1); }
  });

// ── circular ──────────────────────────────────────────────────────────────────

program
  .command('circular [dir]')
  .description('Find circular import chains between files (JS, TS, Python)')
  .option('-f, --format <format>', 'Output format: text | json', 'text')
  .option('-o, --output <file>', 'Write results to a file')
  .option('--fail-on-any', 'Exit with code 1 if any circular imports are found')
  .action(async (dir, options) => {
    try { await circularCommand(dir, options); }
    catch (err) { console.error(chalk.red('Circular check failed:'), err); process.exit(1); }
  });

// ── secrets ───────────────────────────────────────────────────────────────────

program
  .command('secrets [dir]')
  .description('Detect hardcoded API keys, passwords and tokens in source code')
  .option('-f, --format <format>', 'Output format: text | json', 'text')
  .option('-o, --output <file>', 'Write results to a file')
  .option('--fail-on-any', 'Exit with code 1 if any secrets are found')
  .action(async (dir, options) => {
    try { await secretsCommand(dir, options); }
    catch (err) { console.error(chalk.red('Secrets check failed:'), err); process.exit(1); }
  });

// ── scan ──────────────────────────────────────────────────────────────────────

program
  .command('scan [dir]')
  .description('Run all checks at once and display a dashboard summary')
  .option('-f, --format <format>', 'Output format: text | json', 'text')
  .option('-o, --output <file>', 'Write results to a file')
  .option('--fail-on-any', 'Exit with code 1 if any issue is found')
  .action(async (dir, options) => {
    try { await scanCommand(dir, options); }
    catch (err) { console.error(chalk.red('Scan failed:'), err); process.exit(1); }
  });

// ── init ──────────────────────────────────────────────────────────────────────

program
  .command('init')
  .description('Create a .dchrc.json config file in the current directory')
  .action(() => {
    const config = {
      include: ['**/*'],
      exclude: ['**/node_modules/**', '**/dist/**', '**/build/**'],
      entryPoints: ['index.ts', 'main.ts', 'app.ts'],
      ignorePatterns: ['_*', '__*', 'test_*'],
      languages: ['typescript', 'javascript', 'python', 'go', 'java', 'ruby', 'rust', 'php', 'csharp'],
      minConfidence: 0.8,
    };
    fs.writeFileSync('.dchrc.json', JSON.stringify(config, null, 2));
    console.log(chalk.green('Created .dchrc.json'));
  });

if (process.argv.length === 2) {
  program.outputHelp();
  process.exit(0);
}

program.parse();
