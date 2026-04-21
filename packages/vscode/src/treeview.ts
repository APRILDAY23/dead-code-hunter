import * as vscode from 'vscode';
import * as path from 'path';
import type { AnalysisResult, DeadSymbol } from 'dead-code-hunter-core';

export class DeadCodeTreeProvider implements vscode.TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private result: AnalysisResult | null = null;
  private rootDir = '';

  setResult(result: AnalysisResult, rootDir: string): void {
    this.result = result;
    this.rootDir = rootDir;
    this._onDidChangeTreeData.fire();
  }

  clear(): void {
    this.result = null;
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(item: TreeItem): vscode.TreeItem {
    return item;
  }

  getChildren(element?: TreeItem): TreeItem[] {
    if (!this.result) return [new MessageItem('Run analysis to find dead code')];
    if (this.result.deadSymbols.length === 0) return [new MessageItem('No dead code found!')];

    if (!element) {
      // Root: group by file
      const items: TreeItem[] = [];
      for (const [file, syms] of this.result.byFile) {
        items.push(new FileItem(file, syms, this.rootDir));
      }
      return items;
    }

    if (element instanceof FileItem) {
      return element.symbols.map(s => new SymbolItem(s));
    }

    return [];
  }
}

class TreeItem extends vscode.TreeItem {}

class MessageItem extends TreeItem {
  constructor(message: string) {
    super(message, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'message';
  }
}

export class FileItem extends TreeItem {
  constructor(
    public readonly filePath: string,
    public readonly symbols: DeadSymbol[],
    rootDir: string
  ) {
    const rel = filePath.replace(rootDir, '').replace(/\\/g, '/').replace(/^\//, '');
    super(rel, vscode.TreeItemCollapsibleState.Expanded);
    this.description = `${symbols.length} dead symbol${symbols.length === 1 ? '' : 's'}`;
    this.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('list.warningForeground'));
    this.contextValue = 'file';
    this.resourceUri = vscode.Uri.file(filePath);
  }
}

const KIND_ICON: Record<string, string> = {
  function: 'symbol-function',
  method: 'symbol-method',
  class: 'symbol-class',
  variable: 'symbol-variable',
  interface: 'symbol-interface',
  type: 'symbol-key',
  enum: 'symbol-enum',
  struct: 'symbol-structure',
  trait: 'symbol-interface',
  module: 'symbol-module',
};

export class SymbolItem extends TreeItem {
  constructor(public readonly deadSymbol: DeadSymbol) {
    const { definition, reason } = deadSymbol;
    super(`${definition.name}`, vscode.TreeItemCollapsibleState.None);
    this.description = `line ${definition.line}`;
    this.tooltip = new vscode.MarkdownString(`**${definition.kind}** \`${definition.name}\`\n\n${reason}`);
    this.iconPath = new vscode.ThemeIcon(
      KIND_ICON[definition.kind] ?? 'symbol-misc',
      new vscode.ThemeColor('list.warningForeground')
    );
    this.contextValue = 'symbol';
    this.command = {
      command: 'vscode.open',
      title: 'Go to Symbol',
      arguments: [
        vscode.Uri.file(definition.file),
        { selection: new vscode.Range(definition.line - 1, definition.column, definition.line - 1, definition.column) },
      ],
    };
  }
}
