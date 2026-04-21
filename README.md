# Dead Code Hunter

> Find and eliminate unused code across your entire project - multi-language, zero config, CI-ready.

[![CI](https://github.com/APRILDAY23/dead-code-hunter/actions/workflows/ci.yml/badge.svg)](https://github.com/APRILDAY23/dead-code-hunter/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/dead-code-hunter.svg?color=red)](https://www.npmjs.com/package/dead-code-hunter)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

---

## Commands

| Command | What it finds |
|---|---|
| `dch analyze` | Dead functions, classes, and variables never referenced elsewhere |
| `dch files` | Source files that are never imported by anything |
| `dch deps` | npm/pip/gem dependencies listed in manifests but never used in code |
| `dch todos` | Stale TODO / FIXME / HACK / BUG comments with git age and author |
| `dch dupes` | Duplicate or near-identical function bodies across files |
| `dch unreachable` | Code written after `return` / `throw` that can never execute |
| `dch catches` | Empty catch blocks, swallowed errors, and overly broad exception handlers |
| `dch config` | `.env` / `config.json` keys declared but never referenced in source |
| `dch console` | Debug `console.log` / `print` / `fmt.Println` statements left in production code |
| `dch complexity` | Functions with high cyclomatic complexity (hard to maintain and test) |
| `dch circular` | Circular import chains between files that break tree-shaking |
| `dch secrets` | Hardcoded API keys, passwords, and tokens in source code |
| `dch scan` | Run all checks at once and display a dashboard summary |
| `dch fix` | Interactively delete or suppress dead symbols one by one |
| `dch watch` | Re-analyze automatically on every file save |
| `dch baseline` | Snapshot dead code today and fail CI only when new issues appear |
| `dch init` | Create a `.dchrc.json` config file in the current directory |

---

## Supported Languages

| Language | Extensions | Analysis |
|---|---|---|
| TypeScript / JavaScript | `.ts` `.tsx` `.js` `.jsx` `.mjs` | TypeScript Compiler API (full AST) |
| Python | `.py` | Regex AST |
| Go | `.go` | Regex AST |
| Java | `.java` | Regex AST |
| Ruby | `.rb` | Regex AST |
| Rust | `.rs` | Regex AST |
| PHP | `.php` | Regex AST |
| C# | `.cs` | Regex AST |

The analyzer **auto-detects** which languages are present - no configuration needed.

---

## Install

```bash
npm install -g dead-code-hunter
```

Or run without installing:

```bash
npx dead-code-hunter scan
```

---

## Quick Start

```bash
# Run everything at once - get a full picture in one command
dch scan

# Drill into specific issues
dch analyze          # dead symbols
dch files            # unused files
dch deps             # unused dependencies
dch todos            # stale comments
dch dupes            # duplicate code
dch unreachable      # code after return/throw
dch catches          # swallowed errors
dch config           # unused .env keys
dch console          # leftover debug logs
dch complexity       # overly complex functions
dch circular         # circular imports
dch secrets          # hardcoded credentials
```

### Example: `dch scan` output

```
Dead Code Hunter - Full Scan Report
========================================================

  Dead symbols         23  ████░░░░░░░░░░░░░░  run: dch analyze
  Unused files          8  █░░░░░░░░░░░░░░░░░  142KB reclaimable - run: dch files
  Stale comments       41  ████████░░░░░░░░░░  run: dch todos
  Duplicate groups      3  ░░░░░░░░░░░░░░░░░░  ~60 redundant lines - run: dch dupes
  Unreachable code      5  ░░░░░░░░░░░░░░░░░░  run: dch unreachable
  Error handling       12  ██░░░░░░░░░░░░░░░░  run: dch catches
  Unused config keys    4  ░░░░░░░░░░░░░░░░░░  run: dch config
  Unused deps           2  ░░░░░░░░░░░░░░░░░░  run: dch deps
  Debug statements     19  ███░░░░░░░░░░░░░░░  run: dch console
  Complex functions     7  █░░░░░░░░░░░░░░░░░  run: dch complexity
  Circular imports      2  ░░░░░░░░░░░░░░░░░░  run: dch circular
  Secrets found         1  ░░░░░░░░░░░░░░░░░░  run: dch secrets

--------------------------------------------------------
  Total issues: 127  scanned in 1842ms
```

---

## Command Reference

### `dch analyze [dir]`

Finds dead functions, classes, and variables using a cross-file reference graph.

```bash
dch analyze
dch analyze ./src
dch analyze --format json
dch analyze --format html --output report.html
dch analyze --format sarif --output results.sarif
dch analyze --fail-on-dead
dch analyze --languages typescript,python
dch analyze --dead-since 30d   # only symbols untouched for 30+ days
```

### `dch files [dir]`

Finds source files that are never imported anywhere. Detects barrel files (re-export only) separately.

```bash
dch files
dch files --fail-on-dead
```

### `dch deps [dir]`

Finds packages in `package.json` / `requirements.txt` / `Gemfile` that are never actually imported in code.

```bash
dch deps
dch deps --fail-on-dead
```

### `dch todos [dir]`

Finds TODO / FIXME / HACK / XXX / BUG / TEMP / DEPRECATED comments with git blame info.

```bash
dch todos
dch todos --older-than 90     # only comments older than 90 days
dch todos --author alice      # filter by author name
dch todos --fail-on-any
```

### `dch dupes [dir]`

Finds duplicate function bodies using normalized hashing. Shows a code preview and suggests where to extract shared logic.

```bash
dch dupes
dch dupes --min-lines 10      # only flag duplicates of 10+ lines
dch dupes --fail-on-any
```

### `dch unreachable [dir]`

Finds code written after `return`, `throw`, `raise`, `panic()`, or `os.Exit()`.

```bash
dch unreachable
dch unreachable --fail-on-any
```

### `dch catches [dir]`

Finds empty catch blocks, errors that are only logged (swallowed), overly broad exception handlers, and Rust `.unwrap()` / Go `_ = err` patterns.

```bash
dch catches
dch catches --fail-on-any
```

### `dch config [dir]`

Scans `.env`, `.env.*`, `config.json`, and `settings.json` for keys that are never referenced in source code. Understands language-specific access patterns (`process.env.KEY`, `os.environ['KEY']`, `ENV['KEY']`, etc.).

```bash
dch config
dch config --fail-on-dead
```

### `dch console [dir]`

Finds debug print statements left in production code: `console.log`, `print()`, `fmt.Println`, `System.out.println`, `puts`, `dbg!`, `var_dump`, and more. Skips test files by default.

```bash
dch console
dch console --include-tests    # include test files too
dch console --fail-on-any
```

### `dch complexity [dir]`

Calculates cyclomatic complexity for every function and flags those above the threshold. Risk levels: medium (6-10), high (11-15), critical (16+).

```bash
dch complexity
dch complexity --threshold 10  # only report complexity >= 10
dch complexity --fail-on-high  # fail CI if any high/critical functions found
```

### `dch circular [dir]`

Detects circular import chains using Tarjan's strongly connected components algorithm. Works on JS/TS (static imports + `require`) and Python (relative imports).

```bash
dch circular
dch circular --fail-on-any
```

### `dch secrets [dir]`

Detects hardcoded secrets using pattern matching and Shannon entropy analysis. Covers AWS keys, GitHub tokens, API keys, passwords, connection strings, and private keys. Skips `.env.example` and test fixture files. Values are **redacted** in output.

```bash
dch secrets
dch secrets --fail-on-any
```

### `dch scan [dir]`

Runs all 12 checks in parallel and displays a bar-chart dashboard. Use this for a quick overall health check.

```bash
dch scan
dch scan --format json --output report.json
dch scan --fail-on-any
```

### `dch fix [dir]`

Interactive mode - step through each dead symbol and choose to delete it, add a `// dch-ignore` comment, or skip.

```bash
dch fix
```

### `dch watch [dir]`

Watches for file changes and re-runs analysis automatically. Useful during a cleanup session.

```bash
dch watch
```

### `dch baseline <subcommand> [dir]`

Snapshot the current state and fail CI only when **new** issues appear - not existing ones.

```bash
dch baseline save    # save current dead symbols as the baseline
dch baseline diff    # show what's new since the baseline
dch baseline check   # like diff but exits with code 1 if new issues exist
```

---

## CI Integration

### Fail on any new dead code (with baseline)

```yaml
- name: Check for new dead code
  run: |
    dch baseline check
```

### Full gate - fail on any issue

```yaml
- name: Dead code scan
  run: dch scan --fail-on-any
```

### Upload SARIF to GitHub Code Scanning

```yaml
- name: Analyze dead code
  run: dch analyze --format sarif --output dead-code.sarif

- name: Upload to GitHub Code Scanning
  uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: dead-code.sarif
```

---

## Suppressing False Positives

Add `// dch-ignore` on the line before any symbol to exclude it from analysis:

```ts
// dch-ignore
export function legacyApiHandler() { ... }
```

Works in all supported languages using the appropriate comment syntax (`# dch-ignore`, `-- dch-ignore`, etc.).

---

## Configuration (`.dchrc.json`)

```json
{
  "exclude": ["**/node_modules/**", "**/dist/**", "**/build/**"],
  "entryPoints": ["index.ts", "main.ts", "app.ts"],
  "ignorePatterns": ["_*", "__*", "test_*"],
  "languages": ["typescript", "python"],
  "minConfidence": 0.8
}
```

Run `dch init` to generate this file with defaults.

---

## How It Works

1. **Scan** - discovers all source files, respects `.gitignore` and config excludes
2. **Parse** - each language plugin extracts symbol definitions and references
3. **Graph** - builds a cross-file reference graph (nodes = symbols, edges = usages)
4. **Detect** - symbols with zero cross-file references are flagged as dead
5. **Report** - results in your chosen format (text, JSON, HTML, SARIF)

Entry-point files (`index.ts`, `main.go`, etc.) are treated as public API boundaries - their exports are not flagged unless they're also unreferenced by consumers.

---

## Contributing

Contributions are welcome - especially new language plugins. Each language is a single file.

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions, the plugin API, and the PR process.

### Contributors

<!-- CONTRIBUTORS-START -->
<!-- CONTRIBUTORS-END -->

---

## License

[MIT](LICENSE) © 2026 Veda Moola
