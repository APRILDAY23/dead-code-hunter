import type { LanguagePlugin, Definition, Reference } from '../types';

export const phpPlugin: LanguagePlugin = {
  extensions: ['.php'],
  language: 'php',

  analyze(filePath: string, content: string) {
    const definitions: Definition[] = [];
    const references: Reference[] = [];
    const lines = content.split('\n');

    const funcRe = /^\s*(?:public|protected|private|static|\s)*function\s+([a-zA-Z_]\w*)\s*\(/;
    const classRe = /^\s*(?:abstract|final|\s)*class\s+([A-Za-z_]\w*)/;
    const interfaceRe = /^\s*interface\s+([A-Za-z_]\w*)/;
    const traitRe = /^\s*trait\s+([A-Za-z_]\w*)/;
    const callRe = /\b([a-zA-Z_]\w*)\s*\(/g;
    const identRe = /\b([a-zA-Z_]\w*)\b/g;

    const hasDchIgnore = (ln: number) => ln > 1 && /\/\/\s*dch-ignore/.test(lines[ln - 2]);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      const funcMatch = funcRe.exec(line);
      if (funcMatch) {
        const name = funcMatch[1];
        const exported = !line.includes('private') && !line.includes('protected');
        definitions.push({ name, kind: 'function', file: filePath, line: lineNum, column: 0, exported, ignored: hasDchIgnore(lineNum) });
        continue;
      }
      const classMatch = classRe.exec(line);
      if (classMatch) {
        definitions.push({ name: classMatch[1], kind: 'class', file: filePath, line: lineNum, column: 0, exported: true, ignored: hasDchIgnore(lineNum) });
        continue;
      }
      const ifaceMatch = interfaceRe.exec(line);
      if (ifaceMatch) {
        definitions.push({ name: ifaceMatch[1], kind: 'interface', file: filePath, line: lineNum, column: 0, exported: true, ignored: hasDchIgnore(lineNum) });
        continue;
      }
      const traitMatch = traitRe.exec(line);
      if (traitMatch) {
        definitions.push({ name: traitMatch[1], kind: 'trait', file: filePath, line: lineNum, column: 0, exported: true, ignored: hasDchIgnore(lineNum) });
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
