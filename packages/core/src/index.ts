export { analyze, loadConfig, scanFiles, SymbolGraph } from './analyzer';
export { ALL_PLUGINS, getPlugin, getPluginByExt } from './languages/index';
export { consoleReport } from './reporters/console';
export { jsonReport } from './reporters/json';
export { htmlReport } from './reporters/html';
export { sarifReport } from './reporters/sarif';
export type { AnalysisResult, Definition, Reference, DeadSymbol, LanguagePlugin, Config, SymbolKind, LanguageStats, CleanupStats } from './types';
