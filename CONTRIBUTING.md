# Contributing to Dead Code Hunter

Thanks for your interest in contributing! This guide covers everything you need to go from zero to a merged PR.

---

## Table of Contents

- [Project structure](#project-structure)
- [Development setup](#development-setup)
- [Running locally](#running-locally)
- [Adding a language plugin](#adding-a-language-plugin)
- [Branching strategy](#branching-strategy)
- [Submitting a PR](#submitting-a-pr)
- [Release process](#release-process)

---

## Project structure

```
dead-code-hunter/
├── packages/
│   ├── core/          # @dead-code-hunter/core - shared analysis engine
│   │   └── src/
│   │       ├── languages/     # One file per language plugin
│   │       ├── reporters/     # text, JSON, HTML, SARIF output
│   │       ├── analyzer.ts    # Orchestrates scanning + graph
│   │       ├── graph.ts       # Cross-file symbol reference graph
│   │       └── scanner.ts     # File discovery + .gitignore support
│   └── cli/           # dead-code-hunter - the `dch` CLI tool
├── .github/
│   ├── workflows/     # CI and release automation
│   ├── ISSUE_TEMPLATE/
│   └── pull_request_template.md
├── CONTRIBUTING.md    # ← you are here
└── README.md
```

---

## Development setup

**Prerequisites:** Node.js 18+, npm 9+, Git

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

```bash
# Terminal 1 - rebuild core on changes
cd packages/core && npm run dev

# Terminal 2 - rebuild CLI on changes
cd packages/cli && npm run dev

# Terminal 3 - run against any directory
node packages/cli/dist/index.js analyze /path/to/your/project
```

### Available CLI flags

```bash
node packages/cli/dist/index.js analyze --help
```

---

## Adding a language plugin

Each language is a single file in `packages/core/src/languages/`. Adding a new one takes about 30–60 minutes.

### Step 1 - Create the plugin file

Copy an existing simple plugin as a starting point:

```bash
cp packages/core/src/languages/ruby.ts packages/core/src/languages/kotlin.ts
```

### Step 2 - Implement the plugin

Your plugin must export a `LanguagePlugin` object:

```typescript
import type { LanguagePlugin, Definition, Reference } from '../types';

export const kotlinPlugin: LanguagePlugin = {
  extensions: ['.kt', '.kts'],
  language: 'kotlin',

  analyze(filePath: string, content: string) {
    const definitions: Definition[] = [];
    const references: Reference[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      const fnMatch = /^\s*fun\s+([a-zA-Z_]\w*)/.exec(line);
      if (fnMatch) {
        definitions.push({
          name: fnMatch[1],
          kind: 'function',   // 'function' | 'class' | 'method' | 'variable' | etc.
          file: filePath,
          line: lineNum,
          column: 0,
          exported: !fnMatch[1].startsWith('_'),
        });
      }

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

**Definition kinds:** `function`, `method`, `class`, `variable`, `interface`, `type`, `enum`, `struct`, `trait`, `module`

**Exported flag:** set `true` if the symbol is publicly accessible (`public` in Java, uppercase in Go, no leading `_` in Python).

### Step 3 - Register the plugin

Add to `packages/core/src/languages/index.ts`:

```typescript
import { kotlinPlugin } from './kotlin';

export const ALL_PLUGINS: LanguagePlugin[] = [
  // ... existing plugins ...
  kotlinPlugin,
];
```

Add extensions to `LANGUAGE_EXTENSIONS` in `packages/core/src/scanner.ts`:

```typescript
kotlin: ['.kt', '.kts'],
```

Add `'kotlin'` to the default `languages` array in `packages/core/src/config.ts`.

### Step 4 - Test it

```bash
node packages/cli/dist/index.js analyze /path/to/kotlin/project --languages kotlin
```

Verify dead functions are reported and live functions are not.

### Step 5 - Open a PR

Include sample output and the project you tested against in the PR description.

---

## Branching strategy

| Branch | Purpose | How to target |
|--------|---------|---------------|
| `main` | Stable, released code | **Target all PRs here** |
| `feature/xyz` | Your work | Branch from `main`, PR back to `main` |

```bash
git checkout main
git pull origin main
git checkout -b feature/add-kotlin-plugin
# ... make changes ...
git push origin feature/add-kotlin-plugin
# Open PR targeting main on GitHub
```

---

## Submitting a PR

1. Target `main`
2. Fill out the PR template checklist
3. CI must pass (build + type check)
4. At least one reviewer approval required

---

## Release process

Releases are owner-only and fully automated. When code is merged to `main`, the release workflow automatically:

1. Bumps the patch version
2. Publishes `dead-code-hunter-core` and `dead-code-hunter` to npm
3. Creates a GitHub Release with auto-generated notes

**Contributors don't need to worry about this** - just get the PR merged to `main`.

---

## Code of conduct

Be kind, be patient, be constructive. Issues and PRs that are abusive or spammy will be closed without comment.
