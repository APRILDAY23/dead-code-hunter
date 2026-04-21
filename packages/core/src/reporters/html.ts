import type { AnalysisResult } from '../types';

export function htmlReport(result: AnalysisResult, rootDir: string): string {
  const rel = (f: string) => f.replace(rootDir, '').replace(/\\/g, '/').replace(/^\//, '');

  const langCards = result.detectedLanguages.map(l => {
    const pct = l.definitionCount > 0 ? Math.round((l.deadCount / l.definitionCount) * 100) : 0;
    return `<div class="lang-card">
      <div class="lang-name">${cap(l.language)}</div>
      <div class="lang-stat">${l.fileCount} file${l.fileCount === 1 ? '' : 's'}</div>
      <div class="lang-dead">${l.deadCount} dead <span class="pct">(${pct}%)</span></div>
    </div>`;
  }).join('');

  const kindBars = Object.entries(result.cleanup.byKind)
    .sort((a, b) => b[1] - a[1])
    .map(([kind, count]) => {
      const max = Math.max(...Object.values(result.cleanup.byKind));
      const pct = Math.round((count / max) * 100);
      return `<div class="bar-row">
        <span class="bar-label">${cap(kind)}s</span>
        <div class="bar-track"><div class="bar-fill ${kind}" style="width:${pct}%"></div></div>
        <span class="bar-count">${count}</span>
      </div>`;
    }).join('');

  const rows = result.deadSymbols
    .map(({ definition, reason }) =>
      `<tr>
        <td>${escapeHtml(rel(definition.file))}</td>
        <td>${definition.line}</td>
        <td><span class="badge ${definition.kind}">${definition.kind}</span></td>
        <td><code>${escapeHtml(definition.name)}</code></td>
        <td>${definition.exported ? '<span class="yes">✓</span>' : '<span class="no">✗</span>'}</td>
        <td>${escapeHtml(reason)}</td>
      </tr>`
    ).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Dead Code Hunter Report</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 1300px; margin: 0 auto; padding: 2rem; background: #0f0f0f; color: #e0e0e0; }
  h1 { color: #ff6b6b; margin-bottom: 0.25rem; }
  .subtitle { color: #666; font-size: 0.9rem; margin-bottom: 2rem; }
  .stats { display: flex; gap: 1.5rem; margin-bottom: 2rem; flex-wrap: wrap; }
  .stat { background: #1a1a2e; padding: 1rem 1.5rem; border-radius: 8px; text-align: center; min-width: 120px; }
  .stat-num { font-size: 2rem; font-weight: bold; color: #ff6b6b; }
  .stat-label { color: #888; font-size: 0.8rem; margin-top: 2px; }
  h2 { color: #aaa; font-size: 1rem; text-transform: uppercase; letter-spacing: 0.05em; margin: 2rem 0 1rem; }
  .lang-cards { display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 2rem; }
  .lang-card { background: #1a1a2e; border-radius: 8px; padding: 1rem; min-width: 130px; }
  .lang-name { font-weight: bold; color: #fff; margin-bottom: 4px; }
  .lang-stat { color: #666; font-size: 0.8rem; }
  .lang-dead { color: #ff6b6b; font-size: 0.85rem; margin-top: 4px; }
  .pct { color: #888; font-size: 0.75rem; }
  .cleanup { background: #1a1a2e; border-radius: 8px; padding: 1.5rem; margin-bottom: 2rem; }
  .cleanup-num { font-size: 1.5rem; font-weight: bold; color: #ff6b6b; margin-bottom: 1rem; }
  .bar-row { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
  .bar-label { width: 90px; font-size: 0.8rem; color: #888; text-align: right; }
  .bar-track { flex: 1; background: #111; border-radius: 4px; height: 14px; }
  .bar-fill { height: 100%; border-radius: 4px; }
  .bar-count { width: 30px; font-size: 0.8rem; color: #ccc; }
  .function,.method { background: #4da6ff; } .class,.struct { background: #b44dff; }
  .variable { background: #4dff9a; } .interface,.trait { background: #ff9a4d; }
  .type,.enum { background: #ffdd4d; } .module { background: #4dffff; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #1a1a2e; padding: 0.75rem; text-align: left; color: #aaa; font-size: 0.8rem; text-transform: uppercase; }
  td { padding: 0.55rem 0.75rem; border-bottom: 1px solid #1e1e1e; font-size: 0.85rem; }
  tr:hover td { background: #1a1a2e; }
  code { background: #1e1e2e; padding: 0.15rem 0.4rem; border-radius: 3px; font-family: monospace; }
  .badge { padding: 0.15rem 0.45rem; border-radius: 4px; font-size: 0.7rem; font-weight: bold; }
  .yes { color: #4dff9a; } .no { color: #555; }
</style>
</head>
<body>
<h1>Dead Code Hunter</h1>
<div class="subtitle">Generated ${new Date().toISOString().replace('T', ' ').slice(0, 19)} UTC</div>

<div class="stats">
  <div class="stat"><div class="stat-num">${result.scannedFiles}</div><div class="stat-label">Files Scanned</div></div>
  <div class="stat"><div class="stat-num">${result.deadSymbols.length}</div><div class="stat-label">Dead Symbols</div></div>
  <div class="stat"><div class="stat-num">~${result.cleanup.estimatedLines}</div><div class="stat-label">Est. Dead Lines</div></div>
  <div class="stat"><div class="stat-num">${result.durationMs}ms</div><div class="stat-label">Analysis Time</div></div>
</div>

${result.detectedLanguages.length > 0 ? `<h2>Languages Detected</h2><div class="lang-cards">${langCards}</div>` : ''}

${result.deadSymbols.length > 0 ? `
<h2>Cleanup Potential</h2>
<div class="cleanup">
  <div class="cleanup-num">~${result.cleanup.estimatedLines} lines removable across ${result.byFile.size} files</div>
  ${kindBars}
</div>

<h2>Dead Symbols</h2>
<table>
  <thead><tr><th>File</th><th>Line</th><th>Kind</th><th>Name</th><th>Exported</th><th>Reason</th></tr></thead>
  <tbody>${rows}</tbody>
</table>` : '<p style="color:#4dff9a;font-size:1.2rem;margin-top:2rem">No dead code found!</p>'}
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
