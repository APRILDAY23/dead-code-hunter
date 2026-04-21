import * as fs from 'fs';
import type { AnalysisResult, Baseline, BaselineEntry, DeadSymbol } from './types';

const DEFAULT_PATH = '.dch-baseline.json';

export function saveBaseline(result: AnalysisResult, filePath = DEFAULT_PATH): void {
  const baseline: Baseline = {
    createdAt: new Date().toISOString(),
    deadSymbols: result.deadSymbols.map(({ definition }) => ({
      name: definition.name,
      kind: definition.kind,
      file: definition.file,
      line: definition.line,
    })),
  };
  fs.writeFileSync(filePath, JSON.stringify(baseline, null, 2), 'utf-8');
}

export function loadBaseline(filePath = DEFAULT_PATH): Baseline | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Baseline;
  } catch {
    return null;
  }
}

export function diffFromBaseline(
  current: AnalysisResult,
  baseline: Baseline
): DeadSymbol[] {
  const baselineKeys = new Set(
    baseline.deadSymbols.map(e => `${e.file}::${e.name}::${e.kind}`)
  );

  return current.deadSymbols.filter(({ definition }) => {
    const key = `${definition.file}::${definition.name}::${definition.kind}`;
    return !baselineKeys.has(key);
  });
}

export function baselineExists(filePath = DEFAULT_PATH): boolean {
  return fs.existsSync(filePath);
}
