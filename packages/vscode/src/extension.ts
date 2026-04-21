import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { analyze, htmlReport } from '@dead-code-hunter/core';
import type { AnalysisResult } from '@dead-code-hunter/core';
import { DeadCodeTreeProvider } from './treeview';
import { GraphPanel } from './graphPanel';

let diagnosticCollection: vscode.DiagnosticCollection;
let treeProvider: DeadCodeTreeProvider;
let lastResult: AnalysisResult | null = null;
let lastRootDir = '';
let statusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext): void {
  diagnosticCollection = vscode.languages.createDiagnosticCollection('dead-code-hunter');
  treeProvider = new DeadCodeTreeProvider();

  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.command = 'deadCodeHunter.analyze';
  statusBarItem.text = '$(search) Dead Code Hunter';
  statusBarItem.tooltip = 'Click to analyze workspace';
  statusBarItem.show();

  context.subscriptions.push(
    diagnosticCollection,
    statusBarItem,
    vscode.window.registerTreeDataProvider('deadCodeHunter.results', treeProvider),

    vscode.commands.registerCommand('deadCodeHunter.analyze', () => runAnalysis(context)),
    vscode.commands.registerCommand('deadCodeHunter.analyzeFile', () => runFileAnalysis()),
    vscode.commands.registerCommand('deadCodeHunter.showGraph', () => {
      if (lastResult) GraphPanel.show(lastResult, lastRootDir, context.extensionUri);
      else vscode.window.showInformationMessage('Run analysis first.');
    }),
    vscode.commands.registerCommand('deadCodeHunter.clear', () => {
      diagnosticCollection.clear();
      treeProvider.clear();
      lastResult = null;
      statusBarItem.text = '$(search) Dead Code Hunter';
      statusBarItem.backgroundColor = undefined;
    }),
    vscode.commands.registerCommand('deadCodeHunter.exportReport', async () => {
      if (!lastResult) { vscode.window.showInformationMessage('Run analysis first.'); return; }
      const uri = await vscode.window.showSaveDialog({ filters: { 'HTML Report': ['html'] }, defaultUri: vscode.Uri.file(path.join(lastRootDir, 'dead-code-report.html')) });
      if (uri) {
        fs.writeFileSync(uri.fsPath, htmlReport(lastResult, lastRootDir), 'utf-8');
        vscode.window.showInformationMessage(`Report saved to ${uri.fsPath}`);
      }
    })
  );

  // Auto-analyze on save
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(doc => {
      const cfg = vscode.workspace.getConfiguration('deadCodeHunter');
      if (cfg.get('analyzeOnSave')) runAnalysis(context);
    })
  );

  // Auto-analyze on open
  const cfg = vscode.workspace.getConfiguration('deadCodeHunter');
  if (cfg.get('analyzeOnOpen') && vscode.workspace.workspaceFolders?.length) {
    runAnalysis(context);
  }
}

async function runAnalysis(context: vscode.ExtensionContext): Promise<void> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders?.length) {
    vscode.window.showWarningMessage('Open a workspace folder first.');
    return;
  }

  const rootDir = folders[0].uri.fsPath;
  lastRootDir = rootDir;

  statusBarItem.text = '$(loading~spin) Analyzing...';

  try {
    const cfg = vscode.workspace.getConfiguration('deadCodeHunter');
    const languages: string[] = cfg.get('languages') ?? [];
    const severity: string = cfg.get('severity') ?? 'hint';

    const result = await analyze(rootDir, { languages } as never);
    lastResult = result;

    applyDiagnostics(result, severity);
    treeProvider.setResult(result, rootDir);

    const count = result.deadSymbols.length;
    statusBarItem.text = count > 0
      ? `$(warning) ${count} dead symbol${count === 1 ? '' : 's'}`
      : `$(check) No dead code`;
    statusBarItem.backgroundColor = count > 0
      ? new vscode.ThemeColor('statusBarItem.warningBackground')
      : undefined;

    if (count > 0) {
      const action = await vscode.window.showInformationMessage(
        `Dead Code Hunter: found ${count} unused symbol${count === 1 ? '' : 's'} in ${result.scannedFiles} files.`,
        'Show Graph', 'Export Report'
      );
      if (action === 'Show Graph') GraphPanel.show(result, rootDir, context.extensionUri);
      if (action === 'Export Report') vscode.commands.executeCommand('deadCodeHunter.exportReport');
    }
  } catch (err) {
    statusBarItem.text = '$(error) Analysis failed';
    vscode.window.showErrorMessage(`Dead Code Hunter: ${err}`);
  }
}

async function runFileAnalysis(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  const filePath = editor.document.uri.fsPath;
  const rootDir = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? path.dirname(filePath);
  lastRootDir = rootDir;

  statusBarItem.text = '$(loading~spin) Analyzing file...';

  try {
    const cfg = vscode.workspace.getConfiguration('deadCodeHunter');
    const result = await analyze(rootDir, { include: [path.relative(rootDir, filePath)] } as never);
    lastResult = result;
    applyDiagnostics(result, cfg.get('severity') ?? 'hint');
    treeProvider.setResult(result, rootDir);
    statusBarItem.text = `$(warning) ${result.deadSymbols.length} dead`;
  } catch (err) {
    vscode.window.showErrorMessage(`Analysis failed: ${err}`);
  }
}

function severityFromString(s: string): vscode.DiagnosticSeverity {
  switch (s) {
    case 'error': return vscode.DiagnosticSeverity.Error;
    case 'warning': return vscode.DiagnosticSeverity.Warning;
    case 'information': return vscode.DiagnosticSeverity.Information;
    default: return vscode.DiagnosticSeverity.Hint;
  }
}

function applyDiagnostics(result: AnalysisResult, severity: string): void {
  diagnosticCollection.clear();
  const sev = severityFromString(severity);
  const byFile = new Map<string, vscode.Diagnostic[]>();

  for (const { definition, reason } of result.deadSymbols) {
    const line = Math.max(0, definition.line - 1);
    const col = definition.column;
    const range = new vscode.Range(line, col, line, col + definition.name.length);
    const diag = new vscode.Diagnostic(range, `[Dead Code] ${definition.name}: ${reason}`, sev);
    diag.source = 'Dead Code Hunter';
    diag.code = 'DCH001';

    if (!byFile.has(definition.file)) byFile.set(definition.file, []);
    byFile.get(definition.file)!.push(diag);
  }

  for (const [file, diags] of byFile) {
    diagnosticCollection.set(vscode.Uri.file(file), diags);
  }
}

export function deactivate(): void {
  diagnosticCollection?.dispose();
}
