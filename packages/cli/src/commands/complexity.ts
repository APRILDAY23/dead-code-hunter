import { analyzeComplexity, type ComplexityRisk } from 'dead-code-hunter-core';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

const RISK_COLOR: Record<ComplexityRisk, (s: string) => string> = {
  low:      chalk.green,
  medium:   chalk.yellow,
  high:     chalk.red,
  critical: chalk.redBright,
};

const RISK_ICON: Record<ComplexityRisk, string> = {
  low:      '·',
  medium:   '⚠',
  high:     '✖',
  critical: '!!',
};

export async function complexityCommand(
  dir: string | undefined,
  options: { format?: string; output?: string; threshold?: string; failOnHigh?: boolean },
): Promise<void> {
  const rootDir = path.resolve(dir ?? process.cwd());
  const threshold = options.threshold ? parseInt(options.threshold, 10) : 5;
  process.stderr.write(chalk.dim(`Analysing cyclomatic complexity in ${rootDir} (threshold: ${threshold})...\n`));

  const result = await analyzeComplexity(rootDir, threshold);

  let output: string;

  if (options.format === 'json') {
    output = JSON.stringify(result, null, 2) + '\n';
  } else {
    const lines: string[] = [];
    if (result.functions.length === 0) {
      lines.push(chalk.green(`No functions exceed complexity threshold of ${threshold}!`));
    } else {
      // Group by file
      const byFile = new Map<string, typeof result.functions>();
      for (const f of result.functions) {
        const list = byFile.get(f.file) ?? [];
        list.push(f);
        byFile.set(f.file, list);
      }

      for (const [file, fns] of byFile) {
        const rel = path.relative(rootDir, file);
        lines.push(chalk.bold(chalk.cyan(rel)));
        for (const fn of fns) {
          const colorFn = RISK_COLOR[fn.risk];
          const icon = RISK_ICON[fn.risk];
          lines.push(
            `  ${colorFn(icon + ' ' + fn.risk.padEnd(9))}` +
            `  complexity ${colorFn(String(fn.complexity).padStart(3))}` +
            `  ${chalk.bold(fn.name)}` +
            chalk.dim(`:${fn.line}`) +
            chalk.dim(` [${fn.language}]`),
          );
        }
        lines.push('');
      }

      lines.push(chalk.bold('Risk breakdown:'));
      for (const [risk, count] of Object.entries(result.byRisk) as [ComplexityRisk, number][]) {
        if (count > 0) {
          lines.push(`  ${RISK_COLOR[risk](risk.padEnd(10))} ${count}`);
        }
      }

      const critical = result.functions.filter(f => f.risk === 'critical');
      if (critical.length > 0) {
        lines.push('');
        lines.push(chalk.bold('Top offenders:'));
        for (const fn of critical.slice(0, 5)) {
          const rel = path.relative(rootDir, fn.file);
          lines.push(
            `  ${chalk.redBright(String(fn.complexity).padStart(3))}  ${chalk.bold(fn.name)}  ${chalk.dim(rel + ':' + fn.line)}`,
          );
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

  if (result.functions.length > 0) {
    const high = result.byRisk.high + result.byRisk.critical;
    process.stderr.write(
      chalk.yellow(
        `\nFound ${chalk.bold(String(result.functions.length))} complex function(s)` +
        (high > 0 ? ` (${chalk.red(String(high))} high/critical)` : '') +
        ` - ${result.durationMs}ms\n`,
      ),
    );
  }

  if (options.failOnHigh && (result.byRisk.high + result.byRisk.critical) > 0) process.exit(1);
}
