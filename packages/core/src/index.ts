export { analyze, loadConfig, scanFiles, SymbolGraph } from './analyzer';
export { ALL_PLUGINS, getPlugin, getPluginByExt } from './languages/index';
export { consoleReport } from './reporters/console';
export { jsonReport } from './reporters/json';
export { htmlReport } from './reporters/html';
export { sarifReport } from './reporters/sarif';
export { analyzeDeps } from './deps';
export { analyzeFiles } from './files';
export { analyzeTodos } from './todos';
export { analyzeDupes } from './dupes';
export { analyzeUnreachable } from './unreachable';
export { analyzeCatches } from './catches';
export { analyzeConfigKeys } from './configkeys';
export { saveBaseline, loadBaseline, diffFromBaseline, baselineExists } from './baseline';
export { getLineBlame, parseDuration, isInGitRepo } from './git';
export type {
  AnalysisResult, Definition, Reference, DeadSymbol, LanguagePlugin, Config, SymbolKind,
  LanguageStats, CleanupStats, DeadDependency, DepsResult, Baseline, BaselineEntry,
} from './types';
export type { UnusedFile, FilesResult } from './files';
export type { TodoItem, TodosResult } from './todos';
export type { DuplicateGroup, DuplicateOccurrence, DupesResult } from './dupes';
export type { UnreachableCode, UnreachableResult } from './unreachable';
export type { EmptyCatch, CatchesResult, CatchSeverity } from './catches';
export type { DeadConfigKey, ConfigKeysResult } from './configkeys';
export type { UnreachableSeverity } from './unreachable';
export type { TodoKind } from './todos';
export { analyzeConsole } from './console';
export { analyzeComplexity } from './complexity';
export { analyzeCircular } from './circular';
export { analyzeSecrets } from './secrets';
export type { ConsoleStatement, ConsoleResult, ConsoleKind } from './console';
export type { FunctionComplexity, ComplexityResult, ComplexityRisk } from './complexity';
export type { CircularCycle, CircularResult } from './circular';
export type { SecretFinding, SecretsResult, SecretKind } from './secrets';
