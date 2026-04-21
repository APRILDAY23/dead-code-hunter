import * as vscode from 'vscode';
import * as path from 'path';
import type { AnalysisResult } from 'dead-code-hunter-core';

export class GraphPanel {
  static currentPanel: GraphPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  static show(result: AnalysisResult, rootDir: string, extensionUri: vscode.Uri): void {
    if (GraphPanel.currentPanel) {
      GraphPanel.currentPanel.panel.reveal(vscode.ViewColumn.Beside);
      GraphPanel.currentPanel.update(result, rootDir);
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      'deadCodeHunterGraph',
      'Dead Code Graph',
      vscode.ViewColumn.Beside,
      { enableScripts: true, retainContextWhenHidden: true }
    );
    GraphPanel.currentPanel = new GraphPanel(panel, result, rootDir);
  }

  private constructor(panel: vscode.WebviewPanel, result: AnalysisResult, rootDir: string) {
    this.panel = panel;
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.update(result, rootDir);
  }

  private update(result: AnalysisResult, rootDir: string): void {
    this.panel.webview.html = this.getHtml(result, rootDir);
  }

  private dispose(): void {
    GraphPanel.currentPanel = undefined;
    this.panel.dispose();
    this.disposables.forEach(d => d.dispose());
  }

  private getHtml(result: AnalysisResult, rootDir: string): string {
    const rel = (f: string) => path.basename(f);
    const nodes = result.deadSymbols.map((s, i) => ({
      id: i,
      label: s.definition.name,
      file: rel(s.definition.file),
      kind: s.definition.kind,
      line: s.definition.line,
    }));

    const nodesJson = JSON.stringify(nodes);
    const stats = {
      files: result.scannedFiles,
      dead: result.deadSymbols.length,
      ms: result.durationMs,
    };

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Dead Code Graph</title>
<script src="https://d3js.org/d3.v7.min.js"></script>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #1e1e1e; color: #ccc; font-family: var(--vscode-font-family, system-ui); height: 100vh; overflow: hidden; }
  #header { padding: 10px 16px; background: #252526; border-bottom: 1px solid #333; display: flex; align-items: center; gap: 24px; }
  #header h2 { font-size: 14px; color: #fff; }
  .stat { font-size: 12px; color: #888; }
  .stat span { color: #f48771; font-weight: bold; }
  #controls { padding: 8px 16px; background: #2d2d2d; display: flex; gap: 8px; align-items: center; font-size: 12px; }
  .filter-btn { padding: 3px 10px; border: 1px solid #555; border-radius: 3px; background: #3a3a3a; color: #ccc; cursor: pointer; font-size: 11px; }
  .filter-btn.active { background: #0e639c; border-color: #0e639c; color: #fff; }
  #svg-container { width: 100%; height: calc(100vh - 80px); }
  svg { width: 100%; height: 100%; }
  .node circle { stroke-width: 1.5px; cursor: pointer; }
  .node text { font-size: 10px; fill: #ddd; pointer-events: none; }
  .node:hover circle { stroke-width: 3px; }
  #tooltip {
    position: fixed; background: #252526; border: 1px solid #555; border-radius: 4px;
    padding: 8px 12px; font-size: 12px; pointer-events: none; display: none;
    max-width: 260px; line-height: 1.5;
  }
  .legend { position: fixed; bottom: 16px; right: 16px; background: #252526; border: 1px solid #333; padding: 8px 12px; border-radius: 4px; font-size: 11px; }
  .legend-item { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
  .legend-dot { width: 10px; height: 10px; border-radius: 50%; }
</style>
</head>
<body>
<div id="header">
  <h2>Dead Code Graph</h2>
  <div class="stat">Files scanned: <span>${stats.files}</span></div>
  <div class="stat">Dead symbols: <span>${stats.dead}</span></div>
  <div class="stat">Analysis time: <span>${stats.ms}ms</span></div>
</div>
<div id="controls">
  <span style="color:#888; font-size:11px">Filter:</span>
  <button class="filter-btn active" data-kind="all" onclick="filterKind(this,'all')">All</button>
  <button class="filter-btn" data-kind="function" onclick="filterKind(this,'function')">Functions</button>
  <button class="filter-btn" data-kind="class" onclick="filterKind(this,'class')">Classes</button>
  <button class="filter-btn" data-kind="method" onclick="filterKind(this,'method')">Methods</button>
  <button class="filter-btn" data-kind="variable" onclick="filterKind(this,'variable')">Variables</button>
</div>
<div id="svg-container"><svg id="graph"></svg></div>
<div id="tooltip"></div>
<div class="legend" id="legend"></div>

<script>
const ALL_NODES = ${nodesJson};

const KIND_COLOR = {
  function: '#4da6ff',
  method: '#7ab4f5',
  class: '#b44dff',
  variable: '#4dff9a',
  interface: '#ff9a4d',
  type: '#ffdd4d',
  enum: '#ffdd4d',
  struct: '#c44dff',
  trait: '#ff9a4d',
  module: '#4dffff',
};

// Build legend
const legend = document.getElementById('legend');
const kinds = [...new Set(ALL_NODES.map(n => n.kind))];
kinds.forEach(k => {
  const item = document.createElement('div');
  item.className = 'legend-item';
  item.innerHTML = '<div class="legend-dot" style="background:' + (KIND_COLOR[k] || '#888') + '"></div><span>' + k + '</span>';
  legend.appendChild(item);
});

let currentFilter = 'all';

function filterKind(btn, kind) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentFilter = kind;
  renderGraph(kind === 'all' ? ALL_NODES : ALL_NODES.filter(n => n.kind === kind));
}

function renderGraph(nodes) {
  const svg = d3.select('#graph');
  svg.selectAll('*').remove();

  if (nodes.length === 0) {
    svg.append('text').attr('x', '50%').attr('y', '50%')
      .attr('text-anchor', 'middle').attr('fill', '#666').attr('font-size', '14px')
      .text('No symbols match this filter');
    return;
  }

  const W = document.getElementById('svg-container').clientWidth;
  const H = document.getElementById('svg-container').clientHeight;

  const g = svg.append('g');

  svg.call(d3.zoom().scaleExtent([0.1, 4]).on('zoom', e => g.attr('transform', e.transform)));

  // Group nodes by file
  const fileMap = {};
  nodes.forEach(n => { if (!fileMap[n.file]) fileMap[n.file] = []; fileMap[n.file].push(n); });
  const files = Object.keys(fileMap);

  const simulation = d3.forceSimulation(nodes)
    .force('charge', d3.forceManyBody().strength(-120))
    .force('center', d3.forceCenter(W / 2, H / 2))
    .force('collision', d3.forceCollide(36))
    .force('x', d3.forceX(n => {
      const idx = files.indexOf(n.file);
      return (W / (files.length + 1)) * (idx + 1);
    }).strength(0.15))
    .force('y', d3.forceY(H / 2).strength(0.05));

  const node = g.selectAll('.node')
    .data(nodes)
    .enter().append('g')
    .attr('class', 'node')
    .call(d3.drag()
      .on('start', (e, d) => { if (!e.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
      .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y; })
      .on('end', (e, d) => { if (!e.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; })
    );

  node.append('circle')
    .attr('r', 18)
    .attr('fill', d => (KIND_COLOR[d.kind] || '#888') + '33')
    .attr('stroke', d => KIND_COLOR[d.kind] || '#888');

  node.append('text')
    .attr('dy', '0.35em')
    .attr('text-anchor', 'middle')
    .attr('font-size', '9px')
    .text(d => d.label.length > 12 ? d.label.slice(0, 11) + '…' : d.label);

  const tooltip = document.getElementById('tooltip');
  node.on('mouseover', (e, d) => {
    tooltip.style.display = 'block';
    tooltip.innerHTML = '<strong>' + d.label + '</strong><br><span style="color:#888">' + d.kind + '</span><br><span style="color:#666;font-size:10px">' + d.file + ':' + d.line + '</span>';
  }).on('mousemove', e => {
    tooltip.style.left = (e.clientX + 12) + 'px';
    tooltip.style.top = (e.clientY - 8) + 'px';
  }).on('mouseout', () => { tooltip.style.display = 'none'; });

  simulation.on('tick', () => {
    node.attr('transform', d => 'translate(' + d.x + ',' + d.y + ')');
  });
}

renderGraph(ALL_NODES);
</script>
</body>
</html>`;
  }
}
