import type { AnalysisResult } from '../types';
import * as path from 'path';

export function sarifReport(result: AnalysisResult): string {
  const results = result.deadSymbols.map(({ definition, reason }) => ({
    ruleId: `DCH001`,
    message: { text: reason },
    level: 'warning',
    locations: [
      {
        physicalLocation: {
          artifactLocation: { uri: definition.file.replace(/\\/g, '/') },
          region: { startLine: definition.line, startColumn: definition.column + 1 },
        },
        logicalLocations: [{ name: definition.name, kind: definition.kind }],
      },
    ],
  }));

  const sarif = {
    $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'dead-code-hunter',
            version: '1.0.0',
            rules: [
              {
                id: 'DCH001',
                name: 'DeadCode',
                shortDescription: { text: 'Dead code detected' },
                fullDescription: { text: 'Symbol is defined but never referenced from outside its own file.' },
                defaultConfiguration: { level: 'warning' },
              },
            ],
          },
        },
        results,
      },
    ],
  };

  return JSON.stringify(sarif, null, 2);
}
