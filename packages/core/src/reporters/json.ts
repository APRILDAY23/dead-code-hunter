import type { AnalysisResult } from '../types';

export function jsonReport(result: AnalysisResult): string {
  return JSON.stringify(
    {
      scannedFiles: result.scannedFiles,
      deadSymbolCount: result.deadSymbols.length,
      durationMs: result.durationMs,
      detectedLanguages: result.detectedLanguages,
      cleanup: result.cleanup,
      deadSymbols: result.deadSymbols.map(({ definition, reason }) => ({
        ...definition,
        reason,
      })),
    },
    null,
    2
  );
}
