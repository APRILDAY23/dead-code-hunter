import * as fs from 'fs';
import * as path from 'path';
import { scanFiles } from './scanner';
import { SymbolGraph } from './graph';
import { getPluginByExt } from './languages/index';
import { loadConfig } from './config';
import { getLineBlame, parseDuration, isInGitRepo } from './git';
import type { AnalysisResult, Definition, Config, LanguageStats, CleanupStats } from './types';

// Average lines per symbol kind - used to estimate cleanup potential
const AVG_LINES: Record<string, number> = {
  function: 12,
  method: 10,
  class: 30,
  variable: 1,
  interface: 8,
  type: 3,
  enum: 6,
  struct: 15,
  trait: 12,
  module: 20,
};

export async function analyze(rootDir: string, config?: Partial<Config>): Promise<AnalysisResult> {
  const start = Date.now();
  const cfg = { ...loadConfig(rootDir), ...config };

  const files = await scanFiles(rootDir, cfg);
  const graph = new SymbolGraph();
  const allDefinitions = new Map<string, Definition[]>();

  // Track per-language file counts and definition counts
  const langFileCount = new Map<string, number>();
  const langDefCount = new Map<string, number>();

  // Pass 1: extract all definitions
  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    const plugin = getPluginByExt(ext);
    if (!plugin) continue;

    let content: string;
    try {
      content = fs.readFileSync(file, 'utf-8');
    } catch {
      continue;
    }

    const { definitions } = plugin.analyze(file, content);
    allDefinitions.set(file, definitions);
    for (const def of definitions) {
      graph.addDefinition(def);
    }

    langFileCount.set(plugin.language, (langFileCount.get(plugin.language) ?? 0) + 1);
    langDefCount.set(plugin.language, (langDefCount.get(plugin.language) ?? 0) + definitions.length);
  }

  // Pass 2: extract all references and link to definitions
  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    const plugin = getPluginByExt(ext);
    if (!plugin) continue;

    let content: string;
    try {
      content = fs.readFileSync(file, 'utf-8');
    } catch {
      continue;
    }

    const { references } = plugin.analyze(file, content);
    for (const ref of references) {
      graph.addReference(ref, allDefinitions);
    }
  }

  // Determine entry-point files
  const entryFiles = new Set<string>(
    files.filter(f => cfg.entryPoints.some(ep => path.basename(f) === ep))
  );

  let deadSymbols = graph.findDeadSymbols(entryFiles, cfg.ignorePatterns);

  // Enrich with git blame and optionally filter by age
  if (cfg.deadSince && isInGitRepo(rootDir)) {
    const duration = parseDuration(cfg.deadSince);
    if (duration?.days !== undefined) {
      deadSymbols = deadSymbols.filter(sym => {
        const blame = getLineBlame(sym.definition.file, sym.definition.line);
        if (!blame) return true;
        (sym as { daysSinceLastChange?: number }).daysSinceLastChange = blame.daysAgo;
        return blame.daysAgo >= duration.days!;
      });
    }
  } else if (isInGitRepo(rootDir)) {
    for (const sym of deadSymbols) {
      const blame = getLineBlame(sym.definition.file, sym.definition.line);
      if (blame) (sym as { daysSinceLastChange?: number }).daysSinceLastChange = blame.daysAgo;
    }
  }

  // Group dead symbols by file
  const byFile = new Map<string, (typeof deadSymbols)[0][]>();
  for (const sym of deadSymbols) {
    const key = sym.definition.file;
    if (!byFile.has(key)) byFile.set(key, []);
    byFile.get(key)!.push(sym);
  }

  // Per-language dead counts
  const langDeadCount = new Map<string, number>();
  for (const sym of deadSymbols) {
    const ext = path.extname(sym.definition.file).toLowerCase();
    const plugin = getPluginByExt(ext);
    if (!plugin) continue;
    langDeadCount.set(plugin.language, (langDeadCount.get(plugin.language) ?? 0) + 1);
  }

  // Build detected languages list (sorted by file count desc)
  const detectedLanguages: LanguageStats[] = [...langFileCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([language, fileCount]) => ({
      language,
      fileCount,
      definitionCount: langDefCount.get(language) ?? 0,
      deadCount: langDeadCount.get(language) ?? 0,
    }));

  // Cleanup statistics
  const byKind: Record<string, number> = {};
  let estimatedLines = 0;
  for (const { definition } of deadSymbols) {
    byKind[definition.kind] = (byKind[definition.kind] ?? 0) + 1;
    estimatedLines += AVG_LINES[definition.kind] ?? 5;
  }
  const cleanup: CleanupStats = { estimatedLines, byKind };

  return {
    scannedFiles: files.length,
    deadSymbols,
    durationMs: Date.now() - start,
    byFile,
    detectedLanguages,
    cleanup,
  };
}

export { loadConfig, scanFiles, SymbolGraph };
