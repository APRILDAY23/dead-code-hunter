# Dead Code Hunter

Find and eliminate unused code across your entire project - TypeScript, JavaScript, Python, Go, Java, Ruby, Rust, PHP, and C#.

```
npm install -g dead-code-hunter
dch analyze
```

[![npm version](https://img.shields.io/npm/v/dead-code-hunter)](https://www.npmjs.com/package/dead-code-hunter)
[![license](https://img.shields.io/npm/l/dead-code-hunter)](https://github.com/APRILDAY23/dead-code-hunter/blob/main/LICENSE)

---

## Commands at a glance

| Command | Description |
|---------|-------------|
| `dch analyze [dir]` | Scan for dead symbols - functions, classes, variables |
| `dch files [dir]` | Find source files that are never imported by anything |
| `dch deps [dir]` | Find packages declared in your manifest but never imported |
| `dch dupes [dir]` | Find duplicate or near-identical function bodies |
| `dch todos [dir]` | Find stale TODO / FIXME / HACK comments with git age |
| `dch unreachable [dir]` | Find code after return/throw that can never execute |
| `dch catches [dir]` | Find empty catch blocks that silently swallow errors |
| `dch config [dir]` | Find .env / config.json keys never used in source code |
| `dch fix [dir]` | Interactively delete or suppress each dead symbol |
| `dch watch [dir]` | Re-analyze automatically on every file save |
| `dch baseline save [dir]` | Record current dead symbols as a snapshot |
| `dch baseline diff [dir]` | Show dead symbols added since the last snapshot |
| `dch baseline check [dir]` | Like `diff` but exits with code 1 (for CI) |
| `dch init` | Generate a `.dchrc.json` config file with sensible defaults |

---

## Commands

### `dch analyze [dir]`

Scan a directory for unused functions, classes, variables, and more.

```bash
dch analyze              # scan current directory
dch analyze ./src        # scan a specific path
```

**Options**

| Flag | Description |
|------|-------------|
| `-f, --format <fmt>` | Output format: `text` (default), `json`, `html`, `sarif` |
| `-o, --output <file>` | Write report to a file instead of stdout |
| `--fail-on-dead` | Exit code 1 when dead code is found (great for CI) |
| `--languages <langs>` | Comma-separated list of languages to check |
| `--dead-since <duration>` | Only show symbols untouched for this long (e.g. `30d`, `2w`, `3m`) |

```bash
# CI - fail the build if dead code is introduced
dch analyze --fail-on-dead

# Only show code that hasn't been touched in 60 days
dch analyze --dead-since 60d

# Export an HTML report
dch analyze --format html --output report.html

# Only check TypeScript and Python files
dch analyze --languages typescript,python
```

---

### `dch fix [dir]`

Interactively review each dead symbol and choose what to do with it.

```bash
dch fix
```

For each symbol you'll be prompted:

```
src/utils.ts:42  formatDate (function)
  Defined but never referenced outside its own file
  [d]elete  [i]gnore  [s]kip  [q]uit:
```

- **d** - permanently deletes the symbol (and its body)
- **i** - inserts a `// dch-ignore` comment so it's never flagged again
- **s** - skip for now
- **q** - quit

---

### `dch watch [dir]`

Re-analyze automatically whenever a file changes.

```bash
dch watch
```

Clears the terminal and shows fresh results on every save. Press `Ctrl+C` to stop.

---

### `dch deps [dir]`

Find packages listed in your manifest that are never actually imported.

```bash
dch deps
```

Supports **npm** (`package.json`), **pip** (`requirements.txt`), **Go** (`go.mod`), **Cargo** (`Cargo.toml`), and **Bundler** (`Gemfile`).

```bash
dch deps --fail-on-dead      # fail CI if unused deps are found
dch deps --format json       # machine-readable output
```

---

### `dch baseline save|diff|check [dir]`

Track dead code over time. Save a snapshot today, then check whether new dead code has been introduced.

```bash
dch baseline save            # record current dead symbols
dch baseline diff            # show symbols added since the snapshot
dch baseline check           # like diff, but exits 1 if new symbols exist (CI)
```

---

### `dch init`

Generate a `.dchrc.json` config file with sensible defaults.

```bash
dch init
```

---

## Suppressing false positives

Add a `// dch-ignore` comment on the line immediately before any definition to exclude it permanently:

```typescript
// dch-ignore
export function legacyShim() { ... }
```

Works with `#` in Python and Ruby too:

```python
# dch-ignore
def _internal_hook(): ...
```

---

## GitHub PR Bot

Copy `.github/workflows/pr-bot.yml` from the [repo](https://github.com/APRILDAY23/dead-code-hunter) into your project to get automatic dead code comments on every pull request.

---

## Configuration

Create `.dchrc.json` in your project root (or run `dch init`):

```json
{
  "include": ["**/*"],
  "exclude": ["**/node_modules/**", "**/dist/**"],
  "entryPoints": ["index.ts", "main.ts"],
  "ignorePatterns": ["_*", "__*", "test_*"],
  "languages": ["typescript", "javascript", "python", "go", "java", "ruby", "rust", "php", "csharp"],
  "minConfidence": 0.8
}
```

---

## Supported languages

| Language | Extensions |
|----------|-----------|
| TypeScript / JavaScript | `.ts` `.tsx` `.js` `.jsx` `.mjs` `.cjs` |
| Python | `.py` |
| Go | `.go` |
| Java | `.java` |
| Ruby | `.rb` |
| Rust | `.rs` |
| PHP | `.php` |
| C# | `.cs` |

---

## Links

- [GitHub repository](https://github.com/APRILDAY23/dead-code-hunter)
- [Report a bug](https://github.com/APRILDAY23/dead-code-hunter/issues)
- Core library: [`dead-code-hunter-core`](https://www.npmjs.com/package/dead-code-hunter-core)
