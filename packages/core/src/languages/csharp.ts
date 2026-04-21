import type { LanguagePlugin, Definition, Reference } from '../types';

export const csharpPlugin: LanguagePlugin = {
  extensions: ['.cs'],
  language: 'csharp',

  analyze(filePath: string, content: string) {
    const definitions: Definition[] = [];
    const references: Reference[] = [];
    const lines = content.split('\n');

    const classRe = /(?:public|internal|protected|private|abstract|sealed|static|\s)+class\s+([A-Za-z_]\w*)/;
    const interfaceRe = /(?:public|internal|\s)+interface\s+([A-Za-z_]\w*)/;
    const enumRe = /(?:public|internal|private|\s)+enum\s+([A-Za-z_]\w*)/;
    const methodRe = /(?:public|internal|protected|private|static|virtual|override|abstract|async|\s)+[\w<>\[\]?]+\s+([A-Za-z_]\w*)\s*\(/;
    const propRe = /(?:public|internal|protected|private|static|\s)+[\w<>\[\]?]+\s+([A-Za-z_]\w*)\s*\{/;
    const callRe = /\b([a-zA-Z_]\w*)\s*\(/g;
    const identRe = /\b([a-zA-Z_]\w*)\b/g;

    const hasDchIgnore = (ln: number) => ln > 1 && /\/\/\s*dch-ignore/.test(lines[ln - 2].trim());

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lineNum = i + 1;

      if (line.startsWith('//') || line.startsWith('*')) continue;

      const classMatch = classRe.exec(line);
      if (classMatch) {
        definitions.push({ name: classMatch[1], kind: 'class', file: filePath, line: lineNum, column: 0, exported: line.includes('public'), ignored: hasDchIgnore(lineNum) });
        continue;
      }
      const ifaceMatch = interfaceRe.exec(line);
      if (ifaceMatch) {
        definitions.push({ name: ifaceMatch[1], kind: 'interface', file: filePath, line: lineNum, column: 0, exported: true, ignored: hasDchIgnore(lineNum) });
        continue;
      }
      const enumMatch = enumRe.exec(line);
      if (enumMatch) {
        definitions.push({ name: enumMatch[1], kind: 'enum', file: filePath, line: lineNum, column: 0, exported: line.includes('public'), ignored: hasDchIgnore(lineNum) });
        continue;
      }
      const methodMatch = methodRe.exec(line);
      if (methodMatch && !['if', 'while', 'for', 'foreach', 'switch', 'catch', 'using', 'lock'].includes(methodMatch[1])) {
        definitions.push({ name: methodMatch[1], kind: 'method', file: filePath, line: lineNum, column: 0, exported: line.includes('public'), ignored: hasDchIgnore(lineNum) });
        continue;
      }
      const propMatch = propRe.exec(line);
      if (propMatch) {
        definitions.push({ name: propMatch[1], kind: 'variable', file: filePath, line: lineNum, column: 0, exported: line.includes('public'), ignored: hasDchIgnore(lineNum) });
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
