# Dead Code Hunter

Find and eliminate unused code across your entire project - TypeScript, JavaScript, Python, Go, Java, Ruby, Rust, PHP, and C#.

```bash
npm install -g dead-code-hunter
dch scan
```

[![npm version](https://img.shields.io/npm/v/dead-code-hunter)](https://www.npmjs.com/package/dead-code-hunter)
[![license](https://img.shields.io/npm/l/dead-code-hunter)](https://github.com/APRILDAY23/dead-code-hunter/blob/main/LICENSE)

---

## Commands at a glance

| Command | Description |
|---------|-------------|
| `dch scan [dir]` | Run all checks at once and display a dashboard summary |
| `dch analyze [dir]` | Scan for dead symbols - functions, classes, variables |
| `dch files [dir]` | Find source files that are never imported by anything |
| `dch deps [dir]` | Find packages declared in your manifest but never imported |
| `dch todos [dir]` | Find stale TODO / FIXME / HACK comments with git age and author |
| `dch dupes [dir]` | Find duplicate or near-identical function bodies |
| `dch unreachable [dir]` | Find code after return/throw that can never execute |
| `dch catches [dir]` | Find empty catch blocks that silently swallow errors |
| `dch config [dir]` | Find .env / config.json keys never used in source code |
| `dch console [dir]` | Find debug console.log / print / fmt.Println statements |
| `dch complexity [dir]` | Find functions with high cyclomatic complexity |
| `dch circular [dir]` | Find circular import chains between files |
| `dch secrets [dir]` | Detect hardcoded API keys, passwords, and tokens |
| `dch fix [dir]` | Interactively delete or suppress each dead symbol |
| `dch watch [dir]` | Re-analyze automatically on every file save |
| `dch baseline save [dir]` | Record current dead symbols as a snapshot |
| `dch baseline diff [dir]` | Show dead symbols added since the last snapshot |
| `dch baseline check [dir]` | Like `diff` but exits with code 1 (for CI) |
| `dch init` | Generate a `.dchrc.json` config file with sensible defaults |

---

## Commands

### `dch scan [dir]`

Run all 12 checks in parallel and display a bar-chart dashboard. The fastest way to get a health check on any project.

```bash
dch scan
dch scan --format json --output report.json
dch scan --fail-on-any      # fail CI if any issue is found
```

---

### `dch analyze [dir]`

Scan for unused functions, classes, variables, and more using a cross-file reference graph.

```bash
dch analyze              # scan current directory
dch analyze ./src        # scan a specific path
```

| Flag | Description |
|------|-------------|
| `-f, --format <fmt>` | Output format: `text` (default), `json`, `html`, `sarif` |
| `-o, --output <file>` | Write report to a file instead of stdout |
| `--fail-on-dead` | Exit code 1 when dead code is found |
| `--languages <langs>` | Comma-separated list of languages to check |
| `--dead-since <duration>` | Only show symbols untouched for this long (e.g. `30d`, `2w`) |

```bash
dch analyze --fail-on-dead
dch analyze --dead-since 60d
dch analyze --format html --output report.html
dch analyze --languages typescript,python
```

---

### `dch files [dir]`

Find source files that are never imported by any other file. Detects barrel files (re-export only) separately and shows file age and reclaimable bytes.

```bash
dch files
dch files --fail-on-dead
```

---

### `dch deps [dir]`

Find packages in `package.json`, `requirements.txt`, `go.mod`, `Cargo.toml`, and `Gemfile` that are never imported in code.

```bash
dch deps
dch deps --fail-on-dead
```

---

### `dch todos [dir]`

Find TODO / FIXME / HACK / XXX / BUG / TEMP / DEPRECATED comments with git blame age, author, and issue references.

```bash
dch todos
dch todos --older-than 90     # only comments older than 90 days
dch todos --author alice      # filter by author name
dch todos --fail-on-any
```

---

### `dch dupes [dir]`

Find duplicate function bodies using normalized hashing. Shows a code snippet preview and suggests where to extract shared logic.

```bash
dch dupes
dch dupes --min-lines 10      # only flag duplicates of 10+ lines
dch dupes --fail-on-any
```

---

### `dch unreachable [dir]`

Find code written after `return`, `throw`, `raise`, `panic()`, or `os.Exit()`. Shows the full dead block and severity (error for throw/raise, warning for return).

```bash
dch unreachable
dch unreachable --fail-on-any
```

---

### `dch catches [dir]`

Find empty catch blocks, errors that are only logged (swallowed), overly broad exception handlers, Rust `.unwrap()`, and Go `_ = err` patterns. Each finding includes a suggested fix.

```bash
dch catches
dch catches --fail-on-any
```

---

### `dch config [dir]`

Find keys in `.env`, `.env.*`, `config.json`, and `settings.json` that are never referenced in source. Understands language-specific access patterns (`process.env.KEY`, `os.environ['KEY']`, `ENV['KEY']`, `os.Getenv("KEY")`, etc.).

```bash
dch config
dch config --fail-on-dead
```

---

### `dch console [dir]`

Find debug print statements left in production code across all supported languages. Skips test files by default.

- JS/TS: `console.log`, `console.warn`, `console.debug`, etc.
- Python: `print()`, `pprint()`
- Go: `fmt.Println`, `fmt.Printf`, `log.Printf`
- Java: `System.out.println`, `e.printStackTrace()`
- Ruby: `puts`, `p`, `pp`
- Rust: `println!`, `dbg!`, `eprintln!`
- PHP: `var_dump`, `print_r`, `echo`
- C#: `Console.WriteLine`, `Debug.WriteLine`

```bash
dch console
dch console --include-tests    # include test files too
dch console --fail-on-any
```

---

### `dch complexity [dir]`

Calculate cyclomatic complexity for every function and flag those above the threshold. Risk levels: **medium** (6-10), **high** (11-15), **critical** (16+).

```bash
dch complexity
dch complexity --threshold 10   # only report complexity >= 10
dch complexity --fail-on-high   # fail CI on any high/critical function
```

---

### `dch circular [dir]`

Detect circular import chains using Tarjan's strongly connected components algorithm. Works on JS/TS (static imports + `require`) and Python (relative imports).

```bash
dch circular
dch circular --fail-on-any
```

---

### `dch secrets [dir]`

Detect hardcoded secrets using pattern matching and Shannon entropy analysis. Covers:

- AWS access keys (`AKIA...`)
- GitHub tokens (`ghp_...`, `ghs_...`)
- API keys, client secrets, signing secrets
- Passwords and connection string credentials
- Private keys (`-----BEGIN RSA PRIVATE KEY-----`)
- High-entropy strings assigned to sensitive variable names

Skips `.env.example`, test fixtures, and known placeholder values. Secret values are **redacted** in output.

```bash
dch secrets
dch secrets --fail-on-any
```

---

### `dch fix [dir]`

Interactively review each dead symbol and choose what to do:

```
src/utils.ts:42  formatDate (function)
  Defined but never referenced outside its own file
  [d]elete  [i]gnore  [s]kip  [q]uit:
```

- **d** - permanently deletes the symbol
- **i** - inserts a `// dch-ignore` comment
- **s** - skip for now
- **q** - quit

---

### `dch watch [dir]`

Re-analyze automatically on every file save. Press `Ctrl+C` to stop.

```bash
dch watch
```

---

### `dch baseline save|diff|check [dir]`

Track dead code over time. Fail CI only when **new** issues appear - not existing ones.

```bash
dch baseline save    # save current dead symbols as the baseline
dch baseline diff    # show what's new since the baseline
dch baseline check   # like diff but exits 1 if new symbols exist (CI)
```

---

### `dch init`

Generate a `.dchrc.json` config file with sensible defaults.

```bash
dch init
```

---

## Suppressing false positives

Add a `// dch-ignore` comment on the line before any definition to exclude it permanently:

```typescript
// dch-ignore
export function legacyShim() { ... }
```

Works in all languages using the appropriate comment syntax:

```python
# dch-ignore
def _internal_hook(): ...
```

---

## CI Integration

```yaml
# Fail if any new dead code is introduced (recommended)
- name: Dead code check
  run: dch baseline check

# Full gate - fail on any issue found
- name: Full scan
  run: dch scan --fail-on-any

# Upload SARIF to GitHub Code Scanning
- name: Analyze
  run: dch analyze --format sarif --output dead-code.sarif
- name: Upload
  uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: dead-code.sarif
```

---

## Configuration (`.dchrc.json`)

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
