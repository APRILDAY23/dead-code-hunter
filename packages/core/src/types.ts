export type SymbolKind =
  | 'function'
  | 'class'
  | 'method'
  | 'variable'
  | 'interface'
  | 'type'
  | 'enum'
  | 'struct'
  | 'trait'
  | 'module';

export interface Definition {
  name: string;
  kind: SymbolKind;
  file: string;
  line: number;
  column: number;
  exported: boolean;
}

export interface Reference {
  name: string;
  file: string;
  line: number;
}

export interface DeadSymbol {
  definition: Definition;
  reason: string;
}

export interface LanguageStats {
  language: string;
  fileCount: number;
  definitionCount: number;
  deadCount: number;
}

export interface CleanupStats {
  estimatedLines: number;
  byKind: Record<string, number>;
}

export interface AnalysisResult {
  scannedFiles: number;
  deadSymbols: DeadSymbol[];
  durationMs: number;
  byFile: Map<string, DeadSymbol[]>;
  detectedLanguages: LanguageStats[];
  cleanup: CleanupStats;
}

export interface LanguagePlugin {
  extensions: string[];
  language: string;
  analyze(filePath: string, content: string): { definitions: Definition[]; references: Reference[] };
}

export interface Config {
  include: string[];
  exclude: string[];
  entryPoints: string[];
  ignorePatterns: string[];
  languages: string[];
  minConfidence: number;
}
