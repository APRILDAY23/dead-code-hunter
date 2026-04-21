# Contributing to Dead Code Hunter

Thanks for your interest in contributing! This guide covers everything you need to go from zero to a merged PR.

---

## Table of Contents

- [Project structure](#project-structure)
- [Development setup](#development-setup)
- [Running locally](#running-locally)
- [Testing the VS Code extension](#testing-the-vs-code-extension)
- [Adding a language plugin](#adding-a-language-plugin)
- [Branching strategy](#branching-strategy)
- [Submitting a PR](#submitting-a-pr)
- [Release process](#release-process)
- [Secrets management](#secrets-management)

---

## Project structure

```
dead-code-hunter/
├── packages/
│   ├── core/          # @dead-code-hunter/core — shared analysis engine
│   │   └── src/
│   │       ├── languages/     # One file per language plugin
│   │       ├── reporters/     # text, JSON, HTML, SARIF output
│   │       ├── analyzer.ts    # Orchestrates scanning + graph
│   │       ├── graph.ts       # Cross-file symbol reference graph
│   │       └── scanner.ts     # File discovery + .gitignore support
│   ├── cli/           # dead-code-hunter — the `dch` CLI tool
│   └── vscode/        # vscode-dead-code-hunter — VS Code extension
├── .github/
│   ├── workflows/     # CI, release, contributors automation
│   ├── ISSUE_TEMPLATE/
│   └── pull_request_template.md
├── CONTRIBUTING.md    # ← you are here
├── CHANGELOG.md
└── README.md
```

---

## Development setup

**Prerequisites:** Node.js 18+, npm 9+, Git, VS Code (for extension work)

```bash
# 1. Fork the repo on GitHub, then clone your fork
git clone https://github.com/APRILDAY23/dead-code-hunter.git
cd dead-code-hunter

# 2. Install all workspace dependencies
npm install

# 3. Build all packages
npm run build

# 4. Run the CLI against itself to verify
node packages/cli/dist/index.js analyze .
```

---

## Running locally

### CLI (watch mode)

```bash
# Terminal 1 — rebuild core on changes
cd packages/core && npm run dev

# Terminal 2 — rebuild CLI on changes
cd packages/cli && npm run dev

# Terminal 3 — run against any directory
node packages/cli/dist/index.js analyze /path/to/your/project
```

### Available CLI flags

```bash
node packages/cli/dist/index.js analyze --help
```

---

## Testing the VS Code extension

The extension runs in an **Extension Development Host** — a sandboxed VS Code window that loads your local build.

```bash
# 1. Build the extension
cd packages/vscode && npm run dev   # watch mode

# 2. Open the project root in VS Code
code .

# 3. Press F5  (or Run → Start Debugging)
#    This opens a new VS Code window with the extension loaded

# 4. In that new window:
#    - Open a project folder
#    - Open the Command Palette (Ctrl+Shift+P)
#    - Run: "Dead Code Hunter: Analyze Workspace"
#    - Check the sidebar panel and inline diagnostics
```

**To see the graph panel:**
- After running analysis, click the graph icon in the Dead Code Hunter sidebar
- Or run: "Dead Code Hunter: Show Dependency Graph"

---

## Adding a language plugin

Each language is a single file in `packages/core/src/languages/`. Adding a new one takes about 30–60 minutes.

### Step 1 — Create the plugin file

Copy an existing simple plugin (e.g. `ruby.ts`) as a starting point:

```bash
cp packages/core/src/languages/ruby.ts packages/core/src/languages/kotlin.ts
```

### Step 2 — Implement the plugin

Your plugin must export a `LanguagePlugin` object:

```typescript
import type { LanguagePlugin, Definition, Reference } from '../types';

export const kotlinPlugin: LanguagePlugin = {
  extensions: ['.kt', '.kts'],   // file extensions this plugin handles
  language: 'kotlin',

  analyze(filePath: string, content: string) {
    const definitions: Definition[] = [];
    const references: Reference[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      // Extract definitions (functions, classes, etc.)
      const fnMatch = /^\s*(?:fun)\s+([a-zA-Z_]\w*)/.exec(line);
      if (fnMatch) {
        definitions.push({
          name: fnMatch[1],
          kind: 'function',       // 'function' | 'class' | 'method' | 'variable' | etc.
          file: filePath,
          line: lineNum,
          column: 0,
          exported: !fnMatch[1].startsWith('_'),  // your language's visibility rules
        });
      }

      // Extract references (anything that looks like it's being used)
      const identRe = /\b([a-zA-Z_]\w*)\b/g;
      let m: RegExpExecArray | null;
      while ((m = identRe.exec(line)) !== null) {
        references.push({ name: m[1], file: filePath, line: lineNum });
      }
    }

    return { definitions, references };
  },
};
```

**Definition kinds** available: `function`, `method`, `class`, `variable`, `interface`, `type`, `enum`, `struct`, `trait`, `module`

**Exported flag**: In each language, set `exported: true` if the symbol is publicly accessible (e.g. `public` in Java, uppercase in Go, no leading `_` in Python).

### Step 3 — Register the plugin

Add it to `packages/core/src/languages/index.ts`:

```typescript
import { kotlinPlugin } from './kotlin';

export const ALL_PLUGINS: LanguagePlugin[] = [
  // ... existing plugins ...
  kotlinPlugin,   // add here
];
```

Also add the extensions to `LANGUAGE_EXTENSIONS` in `packages/core/src/scanner.ts`:

```typescript
const LANGUAGE_EXTENSIONS: Record<string, string[]> = {
  // ...
  kotlin: ['.kt', '.kts'],
};
```

And add `'kotlin'` to the default `languages` array in `packages/core/src/config.ts`.

### Step 4 — Test it

Grab a real Kotlin project from GitHub (or create a small test file with some unused functions) and run:

```bash
node packages/cli/dist/index.js analyze /path/to/kotlin/project --languages kotlin
```

Verify:
- Dead functions are reported
- Functions that ARE called are not reported as dead
- The output format looks right (`fn`, `class`, etc.)

### Step 5 — Open a PR

Make sure the PR description includes sample output and what project you tested against.

---

## Branching strategy

| Branch | Purpose | How to target |
|--------|---------|---------------|
| `main` | Stable, released code | Never directly — merge from `develop` only |
| `develop` | Active development | **Target all PRs here** |
| `feature/xyz` | Your work | Branch from `develop`, PR back to `develop` |

```bash
# Start a new feature
git checkout develop
git pull origin develop
git checkout -b feature/add-kotlin-plugin

# ... make changes ...

git push origin feature/add-kotlin-plugin
# Then open PR on GitHub targeting develop
```

---

## Submitting a PR

1. **Target `develop`**, not `main`
2. Fill out the PR template checklist
3. CI must pass (build + type check)
4. At least one reviewer approval required
5. Squash-merge preferred for feature branches

---

## Release process

Releases are owner-only, triggered by pushing a version tag:

```bash
# Stable release (from main)
git checkout main && git pull
git tag v1.2.0
git push origin v1.2.0

# Pre-release / beta (from develop)
git checkout develop && git pull
git tag v1.2.0-beta.1
git push origin v1.2.0-beta.1
```

This triggers `release.yml` which:
1. Builds all packages
2. Publishes `@dead-code-hunter/core` and `dead-code-hunter` to npm
3. Publishes the VS Code extension to the VS Code Marketplace
4. Publishes to Open VSX Registry (VSCodium / Gitpod)
5. Creates a GitHub Release with the `.vsix` attached and auto-generated notes

**Contributors do not need to worry about this** — just get the PR merged to `develop`.

---

## Secrets management

This project has **no runtime secrets**. The CLI and VS Code extension make no authenticated API calls. No secrets setup is needed for contributors.

If you're the repo owner setting up CI for the first time, you need three GitHub repository secrets:

| Secret | How to get it |
|--------|--------------|
| `NPM_TOKEN` | npmjs.com → Account → Access Tokens → "Automation" token |
| `VSCE_PAT` | dev.azure.com → User settings → Personal access tokens → Marketplace (Manage) scope |
| `OPEN_VSX_TOKEN` | open-vsx.org → User settings → Access token |

Set them at: `https://github.com/APRILDAY23/dead-code-hunter/settings/secrets/actions`

---

## Code of conduct

Be kind, be patient, be constructive. This is a community project.
Issues and PRs that are abusive, spammy, or off-topic will be closed without comment.
