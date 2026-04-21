# How to Publish the VS Code Extension

This is a one-time setup guide for the repo owner. Contributors do not need this.

---

## Step 1 — Create a VS Code Marketplace Publisher account

1. Go to https://marketplace.visualstudio.com/manage
2. Sign in with a Microsoft account
3. Click **Create publisher**
4. Choose a publisher ID (e.g. `dead-code-hunter`) — this must match `publisher` in `packages/vscode/package.json`

---

## Step 2 — Create an Azure DevOps Personal Access Token (PAT)

This is what `vsce` uses to authenticate when publishing.

1. Go to https://dev.azure.com
2. Click your profile icon → **Personal access tokens**
3. Click **New Token**
4. Set:
   - Name: `vsce-publish`
   - Organization: **All accessible organizations**
   - Expiration: 1 year (or custom)
   - Scopes: **Custom defined** → tick **Marketplace → Manage**
5. Click **Create** and copy the token — you only see it once

---

## Step 3 — Add the PAT as a GitHub Secret

1. Go to your repo on GitHub → **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Name: `VSCE_PAT`
4. Value: the PAT you just copied
5. Save

---

## Step 4 — Add your npm token as a GitHub Secret

1. Go to https://www.npmjs.com → your avatar → **Access Tokens**
2. Click **Generate New Token** → **Automation**
3. Copy the token
4. Back in GitHub Secrets, add:
   - Name: `NPM_TOKEN`
   - Value: the npm token

---

## Step 5 — Add Open VSX token (optional but recommended)

Open VSX is the extension registry for VSCodium, Gitpod, and Eclipse Theia — same extension, different store.

1. Go to https://open-vsx.org
2. Sign in with GitHub
3. Go to **User Settings** → **Access Tokens** → **Generate**
4. Copy the token
5. Add GitHub Secret:
   - Name: `OPEN_VSX_TOKEN`
   - Value: the Open VSX token

---

## Step 6 — Update `release.yml` with your GitHub username

Open `.github/workflows/release.yml` and replace:

```yaml
if: github.actor == 'APRILDAY23'
```

with your actual GitHub username. This guards releases so only you can trigger them.

---

## Step 7 — Trigger your first release

```bash
# Make sure you're on main and everything is built
git checkout main
git pull

# Tag the release
git tag v1.0.0
git push origin v1.0.0
```

The `release.yml` workflow will automatically:
1. Build all packages
2. Bump versions to `1.0.0` in all `package.json` files
3. Publish `@dead-code-hunter/core` to npm
4. Publish `dead-code-hunter` CLI to npm
5. Package the VS Code extension as a `.vsix` file
6. Publish to the VS Code Marketplace
7. Publish to Open VSX
8. Create a GitHub Release with the `.vsix` attached

---

## Manual publish (if CI fails)

```bash
# Install vsce globally
npm install -g @vscode/vsce

# Login with your PAT
vsce login dead-code-hunter

# Build the extension
cd packages/vscode
npm run build

# Package
vsce package

# Publish
vsce publish

# Or publish a specific version
vsce publish 1.0.1
```

---

## Pre-release vs stable

- Tags like `v1.0.0` → published as **stable** on the Marketplace
- Tags like `v1.0.0-beta.1` → published as **pre-release** on the Marketplace

VS Code shows pre-release extensions to users who opt into pre-release updates (Settings → Extensions → Auto Update → Include pre-release versions).

---

## Checking your extension on the Marketplace

After publishing, your extension will be live at:
```
https://marketplace.visualstudio.com/items?itemName=dead-code-hunter.vscode-dead-code-hunter
```

It may take 5–10 minutes for the Marketplace to index it.

---

## Update the badges in README.md

Replace `APRILDAY23` in the badge URLs with your actual GitHub username, and replace `dead-code-hunter.vscode-dead-code-hunter` with your actual publisher ID + extension name if you chose different names.
