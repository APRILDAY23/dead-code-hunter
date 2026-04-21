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
      // Group by declaring file
      const byFile = new Map<string, typeof result.deadKeys>();
      for (const k of result.deadKeys) {
        const list = byFile.get(k.declaredIn) ?? [];
        list.push(k);
        byFile.set(k.declaredIn, list);
      }

      for (const [file, keys] of byFile) {
        const rel = path.relative(rootDir, file);
        lines.push(chalk.bold(chalk.dim(rel) + ` (${keys.length} unused):`));
        for (const k of keys) {
          const preview = k.value.length > 40 ? k.value.slice(0, 40) + '...' : k.value;
          lines.push(
            `  ${chalk.red('unused')} ${chalk.bold(k.key)}${chalk.dim(` = ${preview}`)}`,
          );
          lines.push(chalk.dim(`    hint: ${k.reason}`));
        }
        lines.push('');
      }

      lines.push(chalk.bold('Summary:'));
      lines.push(`  Dead keys:   ${result.deadKeys.length}`);
      lines.push(`  Live keys:   ${result.liveKeys}`);
      lines.push(`  Config files: ${result.configFiles}`);
      lines.push(`  Source files: ${result.scannedFiles}`);
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
      chalk.yellow(`\nFound ${chalk.bold(String(result.deadKeys.length))} unused key(s) (${result.liveKeys} live) across ${result.configFiles} config file(s) - ${result.durationMs}ms\n`),
    );
  }

  if (options.failOnDead && result.deadKeys.length > 0) process.exit(1);
}
