import type { LanguagePlugin, Definition, Reference } from '../types';

export const rubyPlugin: LanguagePlugin = {
  extensions: ['.rb'],
  language: 'ruby',

  analyze(filePath: string, content: string) {
    const definitions: Definition[] = [];
    const references: Reference[] = [];
    const lines = content.split('\n');

    const defRe = /^\s*def\s+(self\.)?([a-zA-Z_]\w*[?!]?)/;
    const classRe = /^\s*class\s+([A-Z][A-Za-z_]*)/;
    const moduleRe = /^\s*module\s+([A-Z][A-Za-z_]*)/;
    const callRe = /\b([a-zA-Z_]\w*[?!]?)\s*[\(]/g;
    const identRe = /\b([a-zA-Z_]\w*)\b/g;

    const hasDchIgnore = (ln: number) => ln > 1 && /#\s*dch-ignore/.test(lines[ln - 2]);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      const defMatch = defRe.exec(line);
      if (defMatch) {
        const name = defMatch[2];
        const exported = !name.startsWith('_') && !line.includes('private') && !line.includes('protected');
        definitions.push({ name, kind: 'method', file: filePath, line: lineNum, column: 0, exported, ignored: hasDchIgnore(lineNum) });
        continue;
      }

      const classMatch = classRe.exec(line);
      if (classMatch) {
        definitions.push({ name: classMatch[1], kind: 'class', file: filePath, line: lineNum, column: 0, exported: true, ignored: hasDchIgnore(lineNum) });
        continue;
      }

      const moduleMatch = moduleRe.exec(line);
      if (moduleMatch) {
        definitions.push({ name: moduleMatch[1], kind: 'module', file: filePath, line: lineNum, column: 0, exported: true, ignored: hasDchIgnore(lineNum) });
        continue;
      }

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
