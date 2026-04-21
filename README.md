# Dead Code Hunter

> Find and eliminate unused code across your entire project — multi-language, zero config, CI-ready.

[![CI](https://github.com/APRILDAY23/dead-code-hunter/actions/workflows/ci.yml/badge.svg)](https://github.com/APRILDAY23/dead-code-hunter/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/dead-code-hunter.svg?color=red)](https://www.npmjs.com/package/dead-code-hunter)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

---

## Supported Languages

| Language | Extensions | Analysis Method |
|---|---|---|
| TypeScript / JavaScript | `.ts` `.tsx` `.js` `.jsx` `.mjs` | TypeScript Compiler API (full AST) |
| Python | `.py` | Regex AST |
| Go | `.go` | Regex AST |
| Java | `.java` | Regex AST |
| Ruby | `.rb` | Regex AST |
| Rust | `.rs` | Regex AST |
| PHP | `.php` | Regex AST |
| C# | `.cs` | Regex AST |

The analyzer **auto-detects** which languages are present in your project by scanning file extensions — no configuration needed to get started.

---

## Install

```bash
npm install -g dead-code-hunter
```

Or run without installing:

```bash
npx dead-code-hunter analyze
```

---

## CLI Usage

```bash
# Analyze current directory (auto-detects languages)
dch analyze

# Analyze a specific path
dch analyze ./src

# JSON output (pipe to other tools)
dch analyze --format json

# HTML report (share with your team)
dch analyze --format html --output report.html

# SARIF output (GitHub Code Scanning)
dch analyze --format sarif --output results.sarif

# Fail CI if dead code is found (exit code 1)
dch analyze --fail-on-dead

# Limit to specific languages
dch analyze --languages typescript,python

# Create a .dchrc.json config file
dch init
```

### Example output

```
Dead Code Hunter Results
========================
Scanned: 142 files  |  Dead symbols: 17  |  Time: 312ms

Languages detected: TypeScript (89 files), Python (38 files), Go (15 files)

Cleanup potential:
  ~640 lines of dead code across 8 files
  Functions: 9   Classes: 2   Variables: 6

  src/utils/formatters.ts
    [fn]    formatLegacyDate    (line 12)  — Defined but never referenced outside its own file
    [fn]    parseOldTimezone    (line 34)  — Defined but never referenced outside its own file
    [var]   DEPRECATED_FORMATS  (line 58)  — Defined but never referenced outside its own file

  src/api/old-client.ts
    [class] LegacyApiClient     (line 1)   — Exported but never imported by any other file

  scripts/migrate.py
    [fn]    run_old_migration   (line 22)  — Defined but never referenced outside its own file
```

---

## CI Integration

### GitHub Actions — fail on dead code

```yaml
- name: Dead Code Check
  run: dch analyze --fail-on-dead
```

### GitHub Actions — upload SARIF to Code Scanning

```yaml
- name: Analyze dead code
  run: dch analyze --format sarif --output dead-code.sarif

- name: Upload to GitHub Code Scanning
  uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: dead-code.sarif
```

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

---

## How It Works

1. **Scan** — discovers all source files respecting `.gitignore` and config excludes; auto-detects languages from file extensions
2. **Parse** — each language plugin extracts symbol definitions and references
3. **Graph** — builds a cross-file reference graph (nodes = symbols, edges = usages)
4. **Detect** — symbols with zero cross-file references are flagged as dead
5. **Stats** — calculates cleanup potential: estimated line count, breakdown by kind
6. **Report** — results in your chosen format

Entry-point files (`index.ts`, `main.go`, etc.) are treated as public API boundaries — their exports are not flagged unless they're also unreferenced by other consumers.

---

## Contributing

We welcome contributions — especially new language plugins! Each language is a single ~60-line file.

See [CONTRIBUTING.md](CONTRIBUTING.md) for full setup instructions, the plugin API, and the PR process.

### Contributors

<!-- CONTRIBUTORS-START -->
<!-- CONTRIBUTORS-END -->

---

## License

[MIT](LICENSE) © 2026 Veda Moola
