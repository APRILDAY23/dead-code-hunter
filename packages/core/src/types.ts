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
  endLine?: number;   // last line of the definition body (for fix command)
  column: number;
  exported: boolean;
  ignored?: boolean;  // true if line has // dch-ignore comment
}

export interface Reference {
  name: string;
  file: string;
  line: number;
}

export interface DeadSymbol {
  definition: Definition;
  reason: string;
  daysSinceLastChange?: number;
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
  deadSince?: string; // e.g. "30d", "2w", "3m", "10commits"
}

export interface DeadDependency {
  name: string;
  manager: string;        // npm, pip, cargo, go, gem, composer
  declaredIn: string;     // path to manifest file
  installedVersion?: string;
}

export interface DepsResult {
  scannedFiles: number;
  deadDependencies: DeadDependency[];
  durationMs: number;
}

export interface BaselineEntry {
  name: string;
  kind: string;
  file: string;
  line: number;
}

export interface Baseline {
  createdAt: string;
  deadSymbols: BaselineEntry[];
}
