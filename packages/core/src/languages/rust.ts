import type { LanguagePlugin, Definition, Reference } from '../types';

export const rustPlugin: LanguagePlugin = {
  extensions: ['.rs'],
  language: 'rust',

  analyze(filePath: string, content: string) {
    const definitions: Definition[] = [];
    const references: Reference[] = [];
    const lines = content.split('\n');

    const fnRe = /^\s*(pub(?:\s*\([^)]*\))?\s+)?(?:async\s+)?fn\s+([a-zA-Z_]\w*)/;
    const structRe = /^\s*(pub(?:\s*\([^)]*\))?\s+)?struct\s+([A-Za-z_]\w*)/;
    const enumRe = /^\s*(pub(?:\s*\([^)]*\))?\s+)?enum\s+([A-Za-z_]\w*)/;
    const traitRe = /^\s*(pub(?:\s*\([^)]*\))?\s+)?trait\s+([A-Za-z_]\w*)/;
    const typeRe = /^\s*(pub(?:\s*\([^)]*\))?\s+)?type\s+([A-Za-z_]\w*)/;
    const constRe = /^\s*(pub(?:\s*\([^)]*\))?\s+)?const\s+([A-Z_]\w*)/;
    const callRe = /\b([a-zA-Z_]\w*)\s*[!(<]/g;
    const identRe = /\b([a-zA-Z_]\w*)\b/g;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      const check = (re: RegExp, kind: Parameters<typeof definitions['push']>[0]['kind']) => {
        const m = re.exec(line);
        if (m) {
          const ignored = lineNum > 1 && /\/\/\s*dch-ignore/.test(lines[lineNum - 2]);
          definitions.push({ name: m[2], kind, file: filePath, line: lineNum, column: 0, exported: !!m[1], ignored });
          return true;
        }
        return false;
      };

      if (check(fnRe, 'function')) continue;
      if (check(structRe, 'struct')) continue;
      if (check(enumRe, 'enum')) continue;
      if (check(traitRe, 'trait')) continue;
      if (check(typeRe, 'type')) continue;
      if (check(constRe, 'variable')) continue;

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
