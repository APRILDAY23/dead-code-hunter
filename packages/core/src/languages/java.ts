import type { LanguagePlugin, Definition, Reference } from '../types';

export const javaPlugin: LanguagePlugin = {
  extensions: ['.java'],
  language: 'java',

  analyze(filePath: string, content: string) {
    const definitions: Definition[] = [];
    const references: Reference[] = [];
    const lines = content.split('\n');

    const classRe = /(?:public|protected|private|abstract|final|static|\s)*class\s+([A-Za-z_]\w*)/;
    const interfaceRe = /(?:public|protected|private|\s)*interface\s+([A-Za-z_]\w*)/;
    const enumRe = /(?:public|protected|private|\s)*enum\s+([A-Za-z_]\w*)/;
    const methodRe = /(?:public|protected|private|static|final|abstract|synchronized|\s)+[\w<>\[\]]+\s+([a-zA-Z_]\w*)\s*\(/;
    const callRe = /\b([a-zA-Z_]\w*)\s*\(/g;
    const identRe = /\b([a-zA-Z_]\w*)\b/g;

    const hasDchIgnore = (ln: number) => ln > 1 && /\/\/\s*dch-ignore/.test(lines[ln - 2].trim());

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lineNum = i + 1;

      const classMatch = classRe.exec(line);
      if (classMatch) {
        const exported = line.includes('public');
        definitions.push({ name: classMatch[1], kind: 'class', file: filePath, line: lineNum, column: 0, exported, ignored: hasDchIgnore(lineNum) });
        continue;
      }

      const ifaceMatch = interfaceRe.exec(line);
      if (ifaceMatch) {
        definitions.push({ name: ifaceMatch[1], kind: 'interface', file: filePath, line: lineNum, column: 0, exported: line.includes('public'), ignored: hasDchIgnore(lineNum) });
        continue;
      }

      const enumMatch = enumRe.exec(line);
      if (enumMatch) {
        definitions.push({ name: enumMatch[1], kind: 'enum', file: filePath, line: lineNum, column: 0, exported: line.includes('public'), ignored: hasDchIgnore(lineNum) });
        continue;
      }

      if (!line.startsWith('//') && !line.startsWith('*')) {
        const methodMatch = methodRe.exec(line);
        if (methodMatch && !['if', 'while', 'for', 'switch', 'catch'].includes(methodMatch[1])) {
          definitions.push({
            name: methodMatch[1],
            kind: 'method',
            file: filePath,
            line: lineNum,
            column: 0,
            exported: line.includes('public'),
            ignored: hasDchIgnore(lineNum),
          });
        }
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
