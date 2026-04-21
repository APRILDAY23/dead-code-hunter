import { analyze } from 'dead-code-hunter-core';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import chalk from 'chalk';

export async function fixCommand(dir: string | undefined): Promise<void> {
  const rootDir = path.resolve(dir ?? process.cwd());

  if (!process.stdin.isTTY) {
    console.error(chalk.red('dch fix requires an interactive terminal'));
    process.exit(1);
  }

  console.error(chalk.dim('Analyzing...'));
  const result = await analyze(rootDir);

  if (result.deadSymbols.length === 0) {
    console.log(chalk.green('No dead code found!'));
    return;
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
  const ask = () => new Promise<string>(res => rl.once('line', res));

  // Group by file, process bottom-up so line numbers stay valid after deletions
  const byFile = new Map<string, typeof result.deadSymbols>();
  for (const sym of result.deadSymbols) {
    const f = sym.definition.file;
    if (!byFile.has(f)) byFile.set(f, []);
    byFile.get(f)!.push(sym);
  }

  let fixed = 0;
  let skipped = 0;
  let quit = false;

  for (const [file, syms] of byFile) {
    if (quit) break;
    const sorted = [...syms].sort((a, b) => b.definition.line - a.definition.line);

    for (const sym of sorted) {
      if (quit) break;
      const rel = path.relative(rootDir, file);
      const { name, kind, line, endLine } = sym.definition;
      const age = sym.daysSinceLastChange !== undefined ? chalk.dim(` · ${sym.daysSinceLastChange}d old`) : '';

      process.stderr.write(
        `\n${chalk.cyan(rel)}:${chalk.yellow(String(line))} ${chalk.bold(name)} ${chalk.dim(`(${kind})`)}${age}\n` +
        `  ${chalk.dim(sym.reason)}\n` +
        `  [d]elete  [i]gnore  [s]kip  [q]uit: `,
      );

      const choice = (await ask()).trim().toLowerCase();

      if (choice === 'q') {
        quit = true;
      } else if (choice === 'd') {
        const fileLines = fs.readFileSync(file, 'utf-8').split('\n');
        const endIdx = (endLine ?? line) - 1;
        const startIdx = line - 1;
        // Also remove a preceding dch-ignore comment if present
        const removeFrom = startIdx > 0 && /(?:\/\/|#)\s*dch-ignore/.test(fileLines[startIdx - 1])
          ? startIdx - 1
          : startIdx;
        fileLines.splice(removeFrom, endIdx - removeFrom + 1);
        fs.writeFileSync(file, fileLines.join('\n'), 'utf-8');
        process.stderr.write(chalk.green(`  ✓ Deleted ${name}\n`));
        fixed++;
      } else if (choice === 'i') {
        const fileLines = fs.readFileSync(file, 'utf-8').split('\n');
        const commentChar = /\.(py|rb)$/.test(file) ? '# dch-ignore' : '// dch-ignore';
        const indent = fileLines[line - 1].match(/^(\s*)/)?.[1] ?? '';
        fileLines.splice(line - 1, 0, `${indent}${commentChar}`);
        fs.writeFileSync(file, fileLines.join('\n'), 'utf-8');
        process.stderr.write(chalk.blue(`  ✓ Marked ${name} as ignored\n`));
        fixed++;
      } else {
        skipped++;
      }
    }
  }

  rl.close();
  process.stderr.write(chalk.bold(`\nDone - fixed: ${fixed}, skipped: ${skipped}\n`));
}
