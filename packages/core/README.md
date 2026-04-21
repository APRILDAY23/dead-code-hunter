# dead-code-hunter-core

Core analysis engine for [Dead Code Hunter](https://www.npmjs.com/package/dead-code-hunter) - the multi-language dead code detection CLI.

This package is the library used by the `dch` CLI. Install the CLI for the command-line experience:

```bash
npm install -g dead-code-hunter
dch scan
```

| Command | Description |
|---------|-------------|
| `dch scan [dir]` | Run all checks at once - dashboard summary |
| `dch analyze [dir]` | Dead symbols - functions, classes, variables |
| `dch files [dir]` | Source files never imported by anything |
| `dch deps [dir]` | Packages in manifests never imported in code |
| `dch todos [dir]` | Stale TODO / FIXME / HACK comments with git age |
| `dch dupes [dir]` | Duplicate or near-identical function bodies |
| `dch unreachable [dir]` | Code after return/throw that can never execute |
| `dch catches [dir]` | Empty catch blocks and swallowed errors |
| `dch config [dir]` | .env / config.json keys never used in source |
| `dch console [dir]` | Debug console.log / print / fmt.Println statements |
| `dch complexity [dir]` | Functions with high cyclomatic complexity |
| `dch circular [dir]` | Circular import chains between files |
| `dch secrets [dir]` | Hardcoded API keys, passwords, and tokens |
| `dch fix [dir]` | Interactively delete or suppress dead symbols |
| `dch watch [dir]` | Re-analyze automatically on every file save |
| `dch baseline save/diff/check` | Snapshot dead code and fail CI only on new issues |
| `dch init` | Generate a `.dchrc.json` config file |

Install this package directly only if you want to embed the analyzer in your own tooling.

```bash
npm install dead-code-hunter-core
```

---

## API

```typescript
import {
  analyze,
  analyzeFiles,
  analyzeDeps,
  analyzeTodos,
  analyzeDupes,
  analyzeUnreachable,
  analyzeCatches,
  analyzeConfigKeys,
  analyzeConsole,
  analyzeComplexity,
  analyzeCircular,
  analyzeSecrets,
  saveBaseline,
  loadBaseline,
  diffFromBaseline,
} from 'dead-code-hunter-core';

// Dead symbols
const result = await analyze('/path/to/project');
console.log(result.deadSymbols);        // DeadSymbol[]
console.log(result.detectedLanguages);  // LanguageStats[]

// Unused files
const files = await analyzeFiles('/path/to/project');
console.log(files.unusedFiles);         // UnusedFile[]
console.log(files.totalBytes);          // number

// Unused dependencies
const deps = await analyzeDeps('/path/to/project');
console.log(deps.deadDependencies);     // DeadDependency[]

// Stale comments
const todos = await analyzeTodos('/path/to/project');
console.log(todos.todos);              // TodoItem[] (with author, issueRef, daysSince)

// Duplicate code
const dupes = await analyzeDupes('/path/to/project', 6);
console.log(dupes.duplicateGroups);    // DuplicateGroup[] (with snippet, suggestedLocation)

// Unreachable code
const unreachable = await analyzeUnreachable('/path/to/project');
console.log(unreachable.unreachableCode); // UnreachableCode[]

// Error handling issues
const catches = await analyzeCatches('/path/to/project');
console.log(catches.emptyCatches);     // EmptyCatch[] (with kind, severity, suggestion)

// Unused config keys
const config = await analyzeConfigKeys('/path/to/project');
console.log(config.deadKeys);          // DeadConfigKey[]

// Debug statements
const debug = await analyzeConsole('/path/to/project', true); // skipTests = true
console.log(debug.statements);         // ConsoleStatement[]

// Cyclomatic complexity
const complexity = await analyzeComplexity('/path/to/project', 5); // threshold = 5
console.log(complexity.functions);     // FunctionComplexity[] (with risk level)

// Circular imports
const circular = await analyzeCircular('/path/to/project');
console.log(circular.cycles);          // CircularCycle[]

// Hardcoded secrets
const secrets = await analyzeSecrets('/path/to/project');
console.log(secrets.findings);         // SecretFinding[] (values redacted)

// Baseline mode
saveBaseline(result, '.dch-baseline.json');
const baseline = loadBaseline('.dch-baseline.json');
const newDead = diffFromBaseline(result, baseline!);
```

---

## Reports

```typescript
import { consoleReport, jsonReport, htmlReport, sarifReport } from 'dead-code-hunter-core';

const text = consoleReport(result, rootDir);
const json = jsonReport(result);
const html = htmlReport(result, rootDir);
const sarif = sarifReport(result);
```

---

## Links

- [CLI (`dead-code-hunter`)](https://www.npmjs.com/package/dead-code-hunter)
- [GitHub](https://github.com/APRILDAY23/dead-code-hunter)
- [Report a bug](https://github.com/APRILDAY23/dead-code-hunter/issues)
