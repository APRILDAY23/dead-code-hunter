import type { LanguagePlugin, Definition, Reference } from '../types';

export const goPlugin: LanguagePlugin = {
  extensions: ['.go'],
  language: 'go',

  analyze(filePath: string, content: string) {
    const definitions: Definition[] = [];
    const references: Reference[] = [];
    const lines = content.split('\n');

    // Exported = starts with uppercase in Go
    const funcRe = /^func\s+(?:\(\w+\s+\*?(\w+)\)\s+)?([A-Za-z_]\w*)\s*\(/;
    const typeRe = /^type\s+([A-Za-z_]\w*)\s+(struct|interface|map|chan|\[)/;
    const varRe = /^(?:var|const)\s+([A-Za-z_]\w*)\s/;
    const callRe = /\b([A-Za-z_]\w*)\s*\(/g;
    const identRe = /\b([A-Za-z_]\w*)\b/g;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      const funcMatch = funcRe.exec(line);
      if (funcMatch) {
        const receiver = funcMatch[1];
        const name = funcMatch[2];
        const fullName = receiver ? `${receiver}.${name}` : name;
        const exported = /^[A-Z]/.test(name);
        definitions.push({ name: fullName, kind: receiver ? 'method' : 'function', file: filePath, line: lineNum, column: 0, exported });
        continue;
      }

      const typeMatch = typeRe.exec(line);
      if (typeMatch) {
        const name = typeMatch[1];
        const kind = typeMatch[2] === 'struct' ? 'struct' : typeMatch[2] === 'interface' ? 'interface' : 'type';
        definitions.push({ name, kind, file: filePath, line: lineNum, column: 0, exported: /^[A-Z]/.test(name) });
        continue;
      }

      const varMatch = varRe.exec(line);
      if (varMatch) {
        const name = varMatch[1];
        definitions.push({ name, kind: 'variable', file: filePath, line: lineNum, column: 0, exported: /^[A-Z]/.test(name) });
        continue;
      }

      // References
      let m: RegExpExecArray | null;
      const callReClone = new RegExp(callRe.source, 'g');
      while ((m = callReClone.exec(line)) !== null) {
        references.push({ name: m[1], file: filePath, line: lineNum });
      }
      const identReClone = new RegExp(identRe.source, 'g');
      while ((m = identReClone.exec(line)) !== null) {
        references.push({ name: m[1], file: filePath, line: lineNum });
      }
    }

    return { definitions, references };
  },
};
