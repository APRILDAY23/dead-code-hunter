export { analyze, loadConfig, scanFiles, SymbolGraph } from './analyzer';
export { ALL_PLUGINS, getPlugin, getPluginByExt } from './languages/index';
export { consoleReport } from './reporters/console';
export { jsonReport } from './reporters/json';
export { htmlReport } from './reporters/html';
export { sarifReport } from './reporters/sarif';
export { analyzeDeps } from './deps';
export { saveBaseline, loadBaseline, diffFromBaseline, baselineExists } from './baseline';
export { getLineBlame, parseDuration, isInGitRepo } from './git';
export type {
  AnalysisResult, Definition, Reference, DeadSymbol, LanguagePlugin, Config, SymbolKind,
  LanguageStats, CleanupStats, DeadDependency, DepsResult, Baseline, BaselineEntry,
} from './types';
