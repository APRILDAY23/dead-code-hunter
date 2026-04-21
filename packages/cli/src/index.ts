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

const program = new Command();

program
  .name('dch')
  .description('Dead Code Hunter - find unused code across your entire project')
  .version('1.0.0');

// ── analyze ──────────────────────────────────────────────────────────────────

program
  .command('analyze [dir]')
  .description('Analyze a directory for dead code')
  .option('-f, --format <format>', 'Output format: text | json | html | sarif', 'text')
  .option('-o, --output <file>', 'Write results to a file instead of stdout')
  .option('--fail-on-dead', 'Exit with code 1 if dead code is found (for CI)')
  .option('--min-confidence <n>', 'Minimum confidence threshold 0–1', '0.8')
  .option('--languages <langs>', 'Comma-separated list of languages to check')
  .option('--dead-since <duration>', 'Only show symbols untouched for this long (e.g. 30d, 2w, 3m, 10commits)')
  .action(async (dir: string | undefined, options) => {
    const rootDir = path.resolve(dir ?? process.cwd());

    if (!fs.existsSync(rootDir)) {
      console.error(chalk.red(`Directory not found: ${rootDir}`));
      process.exit(1);
    }

    console.error(chalk.dim(`Scanning ${rootDir}...`));

    try {
      const extraConfig: Record<string, unknown> = {};
      if (options.languages) extraConfig.languages = (options.languages as string).split(',').map((s: string) => s.trim());
      if (options.deadSince) extraConfig.deadSince = options.deadSince;

      const result = await analyze(rootDir, extraConfig as never);

      let output: string;
      switch (options.format) {
        case 'json':
          output = jsonReport(result);
          break;
        case 'html':
          output = htmlReport(result, rootDir);
          break;
        case 'sarif':
          output = sarifReport(result);
          break;
        default:
          output = consoleReport(result, rootDir);
          if (result.deadSymbols.length > 0) {
            process.stderr.write(chalk.yellow(`\nFound ${chalk.bold(String(result.deadSymbols.length))} dead symbol(s) in ${result.scannedFiles} files - ${result.durationMs}ms\n`));
          } else {
            process.stderr.write(chalk.green('\nNo dead code found!\n'));
          }
      }

      if (options.output) {
        fs.writeFileSync(path.resolve(options.output), output, 'utf-8');
        console.error(chalk.dim(`Report written to ${options.output}`));
      } else {
        process.stdout.write(output);
      }

      if (options.failOnDead && result.deadSymbols.length > 0) process.exit(1);
    } catch (err) {
      console.error(chalk.red('Analysis failed:'), err);
      process.exit(1);
    }
  });

// ── fix ───────────────────────────────────────────────────────────────────────

program
  .command('fix [dir]')
  .description('Interactively delete or suppress dead code symbols')
  .action(async (dir: string | undefined) => {
    try { await fixCommand(dir); }
    catch (err) { console.error(chalk.red('Fix failed:'), err); process.exit(1); }
  });

// ── watch ─────────────────────────────────────────────────────────────────────

program
  .command('watch [dir]')
  .description('Watch for file changes and re-analyze automatically')
  .action(async (dir: string | undefined) => {
    try { await watchCommand(dir); }
    catch (err) { console.error(chalk.red('Watch failed:'), err); process.exit(1); }
  });

// ── deps ──────────────────────────────────────────────────────────────────────

program
  .command('deps [dir]')
  .description('Detect unused dependencies in package manifests')
  .option('-f, --format <format>', 'Output format: text | json', 'text')
  .option('-o, --output <file>', 'Write results to a file instead of stdout')
  .option('--fail-on-dead', 'Exit with code 1 if unused deps are found')
  .action(async (dir: string | undefined, options) => {
    try { await depsCommand(dir, options); }
    catch (err) { console.error(chalk.red('Deps check failed:'), err); process.exit(1); }
  });

// ── baseline ─────────────────────────────────────────────────────────────────

program
  .command('baseline <subcommand> [dir]')
  .description('Baseline management: save | diff | check')
  .option('--fail-on-new', 'Exit with code 1 if new dead symbols are found (for CI)')
  .addHelpText('after', `
Subcommands:
  save   Record current dead symbols as the baseline
  diff   Show dead symbols added since the baseline
  check  Like diff but exits with code 1 if new dead symbols exist`)
  .action(async (subcommand: string, dir: string | undefined, options) => {
    try { await baselineCommand(subcommand, dir, options); }
    catch (err) { console.error(chalk.red('Baseline failed:'), err); process.exit(1); }
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
