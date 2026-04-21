import * as ts from 'typescript';
import * as path from 'path';
import type { LanguagePlugin, Definition, Reference, SymbolKind } from '../types';

function isExported(node: ts.Node): boolean {
  return (
    ts.canHaveModifiers(node) &&
    (ts.getModifiers(node) ?? []).some(m => m.kind === ts.SyntaxKind.ExportKeyword)
  );
}

function getPos(sf: ts.SourceFile, pos: number): { line: number; column: number } {
  const { line, character } = sf.getLineAndCharacterOfPosition(pos);
  return { line: line + 1, column: character };
}

function getEndLine(sf: ts.SourceFile, end: number): number {
  return sf.getLineAndCharacterOfPosition(end).line + 1;
}

function isIgnored(sf: ts.SourceFile, nodeStart: number, lines: string[]): boolean {
  const { line } = sf.getLineAndCharacterOfPosition(nodeStart);
  if (line === 0) return false;
  return /\/\/\s*dch-ignore/.test(lines[line - 1]);
}

export const typescriptPlugin: LanguagePlugin = {
  extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'],
  language: 'typescript',

  analyze(filePath: string, content: string) {
    const definitions: Definition[] = [];
    const references: Reference[] = [];
    const lines = content.split('\n');

    const sf = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);

    function visit(node: ts.Node) {
      // --- Definitions ---
      if (ts.isFunctionDeclaration(node) && node.name) {
        const { line, column } = getPos(sf, node.name.getStart());
        definitions.push({
          name: node.name.text, kind: 'function', file: filePath, line, column,
          endLine: getEndLine(sf, node.end),
          exported: isExported(node), ignored: isIgnored(sf, node.getStart(), lines),
        });
      } else if (ts.isClassDeclaration(node) && node.name) {
        const { line, column } = getPos(sf, node.name.getStart());
        definitions.push({
          name: node.name.text, kind: 'class', file: filePath, line, column,
          endLine: getEndLine(sf, node.end),
          exported: isExported(node), ignored: isIgnored(sf, node.getStart(), lines),
        });
        for (const member of node.members) {
          if (ts.isMethodDeclaration(member) && ts.isIdentifier(member.name)) {
            const mPos = getPos(sf, member.name.getStart());
            definitions.push({
              name: `${node.name!.text}.${member.name.text}`,
              kind: 'method', file: filePath, line: mPos.line, column: mPos.column,
              endLine: getEndLine(sf, member.end),
              exported: isExported(node), ignored: isIgnored(sf, member.getStart(), lines),
            });
          }
        }
      } else if (ts.isVariableStatement(node)) {
        const exp = isExported(node);
        const ign = isIgnored(sf, node.getStart(), lines);
        for (const decl of node.declarationList.declarations) {
          if (ts.isIdentifier(decl.name)) {
            const kind: SymbolKind =
              decl.initializer && (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer))
                ? 'function'
                : 'variable';
            const { line, column } = getPos(sf, decl.name.getStart());
            definitions.push({
              name: decl.name.text, kind, file: filePath, line, column,
              endLine: getEndLine(sf, node.end),
              exported: exp, ignored: ign,
            });
          }
        }
      } else if (ts.isInterfaceDeclaration(node)) {
        const { line, column } = getPos(sf, node.name.getStart());
        definitions.push({
          name: node.name.text, kind: 'interface', file: filePath, line, column,
          endLine: getEndLine(sf, node.end),
          exported: isExported(node), ignored: isIgnored(sf, node.getStart(), lines),
        });
      } else if (ts.isTypeAliasDeclaration(node)) {
        const { line, column } = getPos(sf, node.name.getStart());
        definitions.push({
          name: node.name.text, kind: 'type', file: filePath, line, column,
          endLine: getEndLine(sf, node.end),
          exported: isExported(node), ignored: isIgnored(sf, node.getStart(), lines),
        });
      } else if (ts.isEnumDeclaration(node)) {
        const { line, column } = getPos(sf, node.name.getStart());
        definitions.push({
          name: node.name.text, kind: 'enum', file: filePath, line, column,
          endLine: getEndLine(sf, node.end),
          exported: isExported(node), ignored: isIgnored(sf, node.getStart(), lines),
        });
      }

      // --- References ---
      if (ts.isIdentifier(node)) {
        const p = node.parent;
        const isDefName =
          (ts.isFunctionDeclaration(p) && p.name === node) ||
          (ts.isClassDeclaration(p) && p.name === node) ||
          (ts.isVariableDeclaration(p) && p.name === node) ||
          (ts.isInterfaceDeclaration(p) && p.name === node) ||
          (ts.isTypeAliasDeclaration(p) && p.name === node) ||
          (ts.isEnumDeclaration(p) && p.name === node) ||
          (ts.isMethodDeclaration(p) && p.name === node) ||
          (ts.isPropertyDeclaration(p) && p.name === node);
        if (!isDefName) {
          const { line } = getPos(sf, node.getStart());
          references.push({ name: node.text, file: filePath, line });
        }
      }

      ts.forEachChild(node, visit);
    }

    ts.forEachChild(sf, visit);
    return { definitions, references };
  },
};
