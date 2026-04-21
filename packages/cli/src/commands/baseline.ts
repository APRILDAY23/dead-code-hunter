import { analyze, saveBaseline, loadBaseline, diffFromBaseline } from 'dead-code-hunter-core';
import * as path from 'path';
import chalk from 'chalk';

export async function baselineCommand(
  subcommand: string,
  dir: string | undefined,
  options: { failOnNew?: boolean } = {},
): Promise<void> {
  const rootDir = path.resolve(dir ?? process.cwd());
  const baselinePath = path.join(rootDir, '.dch-baseline.json');

  if (subcommand === 'save') {
    process.stderr.write(chalk.dim('Analyzing...\n'));
    const result = await analyze(rootDir);
    saveBaseline(result, baselinePath);
    console.log(chalk.green(`Baseline saved - ${result.deadSymbols.length} dead symbol(s) recorded`));
    console.log(chalk.dim(`  → ${baselinePath}`));

  } else if (subcommand === 'diff' || subcommand === 'check') {
    const baseline = loadBaseline(baselinePath);
    if (!baseline) {
      console.error(chalk.red('No baseline found. Run `dch baseline save` first.'));
      process.exit(1);
    }

    process.stderr.write(chalk.dim('Analyzing...\n'));
    const result = await analyze(rootDir);
    const newDead = diffFromBaseline(result, baseline);

    if (newDead.length === 0) {
      console.log(chalk.green(`No new dead code since baseline (${baseline.createdAt})`));
    } else {
      for (const sym of newDead) {
        const rel = path.relative(rootDir, sym.definition.file);
        const age = sym.daysSinceLastChange !== undefined ? chalk.dim(` · ${sym.daysSinceLastChange}d old`) : '';
        console.log(
          chalk.red('NEW') + ' ' + chalk.bold(sym.definition.name) +
          chalk.dim(` (${sym.definition.kind})`) + ` - ${chalk.cyan(rel)}:${chalk.yellow(String(sym.definition.line))}` + age,
        );
      }
      process.stderr.write(chalk.yellow(`\n${newDead.length} new dead symbol(s) since baseline (${baseline.createdAt})\n`));
      if (subcommand === 'check' || options.failOnNew) process.exit(1);
    }
  } else {
    console.error(chalk.red(`Unknown subcommand: ${subcommand}`));
    console.error('Usage: dch baseline <save|diff|check> [dir]');
    process.exit(1);
  }
}
