import type { Definition, Reference, DeadSymbol } from './types';

export interface GraphNode {
  definition: Definition;
  referencedBy: Set<string>; // file paths that reference this symbol
}

export class SymbolGraph {
  private nodes = new Map<string, GraphNode>(); // key: `file:name`

  addDefinition(def: Definition): void {
    const key = `${def.file}::${def.name}`;
    if (!this.nodes.has(key)) {
      this.nodes.set(key, { definition: def, referencedBy: new Set() });
    }
  }

  addReference(ref: Reference, allDefinitions: Map<string, Definition[]>): void {
    for (const [file, defs] of allDefinitions) {
      if (file === ref.file) continue; // skip self-references
      for (const def of defs) {
        if (def.name === ref.name) {
          const key = `${file}::${def.name}`;
          this.nodes.get(key)?.referencedBy.add(ref.file);
        }
      }
    }
  }

  findDeadSymbols(entryFiles: Set<string>, ignorePatterns: string[]): DeadSymbol[] {
    const dead: DeadSymbol[] = [];
    const ignoreRegexes = ignorePatterns.map(p => {
      const escaped = p.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
      return new RegExp(`^${escaped}$`);
    });

    for (const [, node] of this.nodes) {
      const { definition, referencedBy } = node;

      // Skip symbols matching ignore patterns
      if (ignoreRegexes.some(r => r.test(definition.name))) continue;

      // Exported symbols in entry point files are public API — not dead
      if (definition.exported && entryFiles.has(definition.file)) continue;

      // If no cross-file references exist, it's potentially dead
      if (referencedBy.size === 0) {
        const reason = definition.exported
          ? 'Exported but never imported by any other file'
          : 'Defined but never referenced outside its own file';
        dead.push({ definition, reason });
      }
    }

    return dead;
  }

  toJSON(): object {
    const nodes: object[] = [];
    const edges: object[] = [];

    for (const [key, node] of this.nodes) {
      nodes.push({
        id: key,
        name: node.definition.name,
        kind: node.definition.kind,
        file: node.definition.file,
        line: node.definition.line,
        exported: node.definition.exported,
        dead: node.referencedBy.size === 0,
      });
      for (const fromFile of node.referencedBy) {
        edges.push({ source: fromFile, target: key });
      }
    }

    return { nodes, edges };
  }
}
