import { analyzeConfigKeys } from 'dead-code-hunter-core';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

export async function configKeysCommand(
  dir: string | undefined,
  options: { format?: string; output?: string; failOnDead?: boolean },
): Promise<void> {
  const rootDir = path.resolve(dir ?? process.cwd());
  process.stderr.write(chalk.dim(`Scanning for unused config keys in ${rootDir}...\n`));

  const result = await analyzeConfigKeys(rootDir);

  if (result.configFiles === 0) {
    process.stderr.write(chalk.dim('No .env or config.json files found.\n'));
    return;
  }

  let output: string;

  if (options.format === 'json') {
    output = JSON.stringify(result, null, 2) + '\n';
  } else {
    const lines: string[] = [];
    if (result.deadKeys.length === 0) {
      lines.push(chalk.green('All config keys are referenced in source code!'));
    } else {
      for (const k of result.deadKeys) {
        const rel = path.relative(rootDir, k.declaredIn);
        lines.push(
          chalk.red('unused') + ' ' + chalk.bold(k.key) +
          chalk.dim(` = ${k.value}`) +
          chalk.dim(` (${rel})`),
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

  if (result.deadKeys.length > 0) {
    process.stderr.write(
      chalk.yellow(`\nFound ${chalk.bold(String(result.deadKeys.length))} unused key(s) across ${result.configFiles} config file(s) - ${result.durationMs}ms\n`),
    );
  }

  if (options.failOnDead && result.deadKeys.length > 0) process.exit(1);
}
