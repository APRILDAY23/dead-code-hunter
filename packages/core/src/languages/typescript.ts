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

export const typescriptPlugin: LanguagePlugin = {
  extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'],
  language: 'typescript',

  analyze(filePath: string, content: string) {
    const definitions: Definition[] = [];
    const references: Reference[] = [];

    const sf = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);

    function visit(node: ts.Node) {
      // --- Definitions ---
      if (ts.isFunctionDeclaration(node) && node.name) {
        const { line, column } = getPos(sf, node.name.getStart());
        definitions.push({ name: node.name.text, kind: 'function', file: filePath, line, column, exported: isExported(node) });
      } else if (ts.isClassDeclaration(node) && node.name) {
        const { line, column } = getPos(sf, node.name.getStart());
        definitions.push({ name: node.name.text, kind: 'class', file: filePath, line, column, exported: isExported(node) });
        // Methods inside class
        for (const member of node.members) {
          if (ts.isMethodDeclaration(member) && ts.isIdentifier(member.name)) {
            const mPos = getPos(sf, member.name.getStart());
            definitions.push({
              name: `${node.name!.text}.${member.name.text}`,
              kind: 'method',
              file: filePath,
              line: mPos.line,
              column: mPos.column,
              exported: isExported(node),
            });
          }
        }
      } else if (ts.isVariableStatement(node)) {
        const exp = isExported(node);
        for (const decl of node.declarationList.declarations) {
          if (ts.isIdentifier(decl.name)) {
            const kind: SymbolKind =
              decl.initializer && (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer))
                ? 'function'
                : 'variable';
            const { line, column } = getPos(sf, decl.name.getStart());
            definitions.push({ name: decl.name.text, kind, file: filePath, line, column, exported: exp });
          }
        }
      } else if (ts.isInterfaceDeclaration(node)) {
        const { line, column } = getPos(sf, node.name.getStart());
        definitions.push({ name: node.name.text, kind: 'interface', file: filePath, line, column, exported: isExported(node) });
      } else if (ts.isTypeAliasDeclaration(node)) {
        const { line, column } = getPos(sf, node.name.getStart());
        definitions.push({ name: node.name.text, kind: 'type', file: filePath, line, column, exported: isExported(node) });
      } else if (ts.isEnumDeclaration(node)) {
        const { line, column } = getPos(sf, node.name.getStart());
        definitions.push({ name: node.name.text, kind: 'enum', file: filePath, line, column, exported: isExported(node) });
      }

      // --- References ---
      if (ts.isIdentifier(node) && !ts.isDeclaration(node.parent)) {
        const { line } = getPos(sf, node.getStart());
        references.push({ name: node.text, file: filePath, line });
      }

      ts.forEachChild(node, visit);
    }

    ts.forEachChild(sf, visit);
    return { definitions, references };
  },
};
