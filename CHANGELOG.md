# Changelog

All notable changes to Dead Code Hunter are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- Initial release of Dead Code Hunter

---

## [1.0.0] - 2026-04-21

### Added
- Core analysis engine (`@dead-code-hunter/core`) with cross-file symbol graph
- Language plugins: TypeScript/JavaScript (TS compiler API), Python, Go, Java, Ruby, Rust, PHP, C#
- CLI tool (`dead-code-hunter`) with `dch analyze`, `dch init` commands
- Output formats: text, JSON, HTML, SARIF (GitHub Code Scanning compatible)
- `--fail-on-dead` flag for CI pipelines
- VS Code extension with:
  - Inline diagnostics (configurable severity: hint/warning/error)
  - Sidebar tree view grouped by file — click to jump to symbol
  - D3 interactive force graph with kind-based filtering
  - Status bar counter
  - Auto-analyze on save and on workspace open (configurable)
  - Export HTML report command
- `.gitignore` awareness in file scanner
- `.dchrc.json` config file support
- Entry-point detection (index.ts, main.go, app.py, etc.) to protect public API exports
- Ignore patterns for test files and underscore-prefixed symbols
