import type { LanguagePlugin, Definition, Reference } from '../types';

export const pythonPlugin: LanguagePlugin = {
  extensions: ['.py'],
  language: 'python',

  analyze(filePath: string, content: string) {
    const definitions: Definition[] = [];
    const references: Reference[] = [];
    const lines = content.split('\n');

    const defRe = /^(\s*)(async\s+)?def\s+([a-zA-Z_]\w*)\s*\(/;
    const classRe = /^(\s*)class\s+([a-zA-Z_]\w*)\s*[:(]/;
    const assignRe = /^([a-zA-Z_]\w*)\s*=/;
    const callRe = /\b([a-zA-Z_]\w*)\s*\(/g;
    const attrRe = /\b([a-zA-Z_]\w*)\b/g;

    // Detect if module-level __all__ is defined (marks public API)
    const hasAll = /__all__\s*=/.test(content);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      const defMatch = defRe.exec(line);
      if (defMatch) {
        const indent = defMatch[1].length;
        const name = defMatch[3];
        definitions.push({
          name,
          kind: indent === 0 ? 'function' : 'method',
          file: filePath,
          line: lineNum,
          column: indent,
          exported: !name.startsWith('_') && !hasAll,
        });
        continue;
      }

      const classMatch = classRe.exec(line);
      if (classMatch) {
        const indent = classMatch[1].length;
        const name = classMatch[2];
        definitions.push({
          name,
          kind: 'class',
          file: filePath,
          line: lineNum,
          column: indent,
          exported: !name.startsWith('_'),
        });
        continue;
      }

      // Top-level module variable
      const assignMatch = assignRe.exec(line);
      if (assignMatch && !line.startsWith(' ')) {
        const name = assignMatch[1];
        if (name !== '__all__' && name !== '__name__' && !name.startsWith('_')) {
          definitions.push({ name, kind: 'variable', file: filePath, line: lineNum, column: 0, exported: true });
        }
      }

      // References — function calls
      let m: RegExpExecArray | null;
      const callReClone = new RegExp(callRe.source, 'g');
      while ((m = callReClone.exec(line)) !== null) {
        references.push({ name: m[1], file: filePath, line: lineNum });
      }

      // References — identifiers
      const attrReClone = new RegExp(attrRe.source, 'g');
      while ((m = attrReClone.exec(line)) !== null) {
        references.push({ name: m[1], file: filePath, line: lineNum });
      }
    }

    return { definitions, references };
  },
};
