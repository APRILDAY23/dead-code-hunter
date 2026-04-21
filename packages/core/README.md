# dead-code-hunter-core

Core analysis engine for [Dead Code Hunter](https://www.npmjs.com/package/dead-code-hunter) — the multi-language dead code detection CLI.

This package is the library used by the `dch` CLI. Install the CLI for the command-line experience:

```bash
npm install -g dead-code-hunter
```

| Command | Description |
|---------|-------------|
| `dch analyze [dir]` | Scan for dead symbols — functions, classes, variables, and more |
| `dch fix [dir]` | Interactively delete or suppress each dead symbol one by one |
| `dch watch [dir]` | Re-analyze automatically on every file save |
| `dch deps [dir]` | Find packages declared in your manifest but never imported |
| `dch baseline save` | Record current dead symbols as a snapshot |
| `dch baseline diff` | Show dead symbols added since the last snapshot |
| `dch baseline check` | Like `diff` but exits with code 1 (for CI) |
| `dch init` | Generate a `.dchrc.json` config file with sensible defaults |

Install this package directly only if you want to embed the analyzer in your own tooling.

```
npm install dead-code-hunter-core
```

## API

```typescript
import { analyze, analyzeDeps, saveBaseline, loadBaseline, diffFromBaseline } from 'dead-code-hunter-core';

// Find dead symbols
const result = await analyze('/path/to/project');
console.log(result.deadSymbols);     // DeadSymbol[]
console.log(result.detectedLanguages); // LanguageStats[]
console.log(result.cleanup);          // { estimatedLines, byKind }

// Find unused dependencies
const deps = await analyzeDeps('/path/to/project');
console.log(deps.deadDependencies);  // DeadDependency[]

// Baseline mode
saveBaseline(result, '.dch-baseline.json');
const baseline = loadBaseline('.dch-baseline.json');
const newDead = diffFromBaseline(result, baseline!);
```

## Reports

```typescript
import { consoleReport, jsonReport, htmlReport, sarifReport } from 'dead-code-hunter-core';

const text = consoleReport(result, rootDir);
const json = jsonReport(result);
const html = htmlReport(result, rootDir);
const sarif = sarifReport(result);
```

## Links

- [CLI (`dead-code-hunter`)](https://www.npmjs.com/package/dead-code-hunter)
- [GitHub](https://github.com/APRILDAY23/dead-code-hunter)
