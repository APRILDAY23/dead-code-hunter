# Changelog

All notable changes to Dead Code Hunter are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

---

## [1.0.0] - 2026-04-21

### Added
- Core analysis engine (`@dead-code-hunter/core`) with cross-file symbol reference graph
- Language plugins: TypeScript/JavaScript (TypeScript Compiler API), Python, Go, Java, Ruby, Rust, PHP, C#
- Auto-detection of project languages from file extensions — zero config required
- CLI tool (`dead-code-hunter`) with `dch analyze` and `dch init` commands
- Output formats: text, JSON, HTML, SARIF (GitHub Code Scanning compatible)
- `--fail-on-dead` flag for CI pipelines
- Cleanup statistics: estimated removable line count, breakdown by symbol kind, per-language dead code percentage
- `.gitignore` awareness in file scanner
- `.dchrc.json` config file support
- Entry-point detection (`index.ts`, `main.go`, `app.py`, etc.) to protect public API exports
- Ignore patterns for test files and underscore-prefixed symbols
