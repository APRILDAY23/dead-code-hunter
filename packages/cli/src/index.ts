#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import { analyze, consoleReport, jsonReport, htmlReport, sarifReport } from '@dead-code-hunter/core';

const program = new Command();

program
  .name('dch')
  .description('Dead Code Hunter — find unused code across your entire project')
  .version('1.0.0');

program
  .command('analyze [dir]')
  .description('Analyze a directory for dead code')
  .option('-f, --format <format>', 'Output format: text | json | html | sarif', 'text')
  .option('-o, --output <file>', 'Write results to a file instead of stdout')
  .option('--fail-on-dead', 'Exit with code 1 if dead code is found (for CI)')
  .option('--min-confidence <n>', 'Minimum confidence threshold 0–1', '0.8')
  .option('--languages <langs>', 'Comma-separated list of languages to check')
  .action(async (dir: string | undefined, options) => {
    const rootDir = path.resolve(dir ?? process.cwd());

    if (!fs.existsSync(rootDir)) {
      console.error(chalk.red(`Directory not found: ${rootDir}`));
      process.exit(1);
    }

    console.error(chalk.dim(`Scanning ${rootDir}...`));

    try {
      const extraConfig = options.languages
        ? { languages: (options.languages as string).split(',').map((s: string) => s.trim()) }
        : {};

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
            process.stderr.write(chalk.yellow(`\nFound ${chalk.bold(result.deadSymbols.length)} dead symbol(s) in ${result.scannedFiles} files.\n`));
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

      if (options.failOnDead && result.deadSymbols.length > 0) {
        process.exit(1);
      }
    } catch (err) {
      console.error(chalk.red('Analysis failed:'), err);
      process.exit(1);
    }
  });

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

program.parse();
