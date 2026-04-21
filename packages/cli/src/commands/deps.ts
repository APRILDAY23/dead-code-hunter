import { analyzeDeps } from 'dead-code-hunter-core';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

export async function depsCommand(
  dir: string | undefined,
  options: { format?: string; output?: string; failOnDead?: boolean },
): Promise<void> {
  const rootDir = path.resolve(dir ?? process.cwd());

  if (!fs.existsSync(rootDir)) {
    console.error(chalk.red(`Directory not found: ${rootDir}`));
    process.exit(1);
  }

  process.stderr.write(chalk.dim(`Scanning dependencies in ${rootDir}...\n`));
  const result = await analyzeDeps(rootDir);

  let output: string;

  if (options.format === 'json') {
    output = JSON.stringify(result, null, 2) + '\n';
  } else {
    const lines: string[] = [];
    if (result.deadDependencies.length === 0) {
      lines.push(chalk.green('No unused dependencies found!'));
    } else {
      for (const dep of result.deadDependencies) {
        const rel = path.relative(rootDir, dep.declaredIn);
        lines.push(
          chalk.red('✗') + ' ' + chalk.bold(dep.name) +
          chalk.dim(` (${dep.manager})`) +
          chalk.dim(` - ${rel}`) +
          (dep.installedVersion ? chalk.dim(` @ ${dep.installedVersion}`) : ''),
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

  if (result.deadDependencies.length > 0) {
    process.stderr.write(
      chalk.yellow(`\nFound ${chalk.bold(String(result.deadDependencies.length))} unused dependency(s) across ${result.scannedFiles} files - ${result.durationMs}ms\n`),
    );
  }

  if (options.failOnDead && result.deadDependencies.length > 0) process.exit(1);
}
