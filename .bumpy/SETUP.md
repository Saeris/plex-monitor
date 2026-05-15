# Bumpy Setup Guide

Lessons learned from setting up Bumpy (`@varlock/bumpy`) for versioning, changelog generation, and npm publishing with GitHub Actions. Written as a reference for new repos.

---

## 1. Initial Configuration

```json
// .bumpy/_config.json
{
  "$schema": "../node_modules/@varlock/bumpy/config-schema.json",
  "baseBranch": "main",
  "changelog": "github",
  "githubRelease": true
}
```

- `"changelog": "github"` — generates rich release notes with commit SHAs and author links (matches Changesets-style output)
- `"githubRelease": true` — tells Bumpy to create the GitHub release body from bump file summaries; without this, releases are created with no notes

Run once to configure the `BUMPY_GH_TOKEN` secret needed for Bumpy to trigger CI on version PRs:

```
vp dlx @varlock/bumpy ci setup
```

---

## 2. npm OIDC Trusted Publishing

This is the most finicky part. Several things must be correct before the first automated publish.

### Publish 1.0.0 manually first

npm OIDC trusted publishing requires the package to already exist on the registry. Publish manually before wiring up CI:

```
npm publish --access public
```

### Register the trusted publisher

```
npm trust github @scope/package --repo Owner/repo --file release.yml
```

**Critical: `--repo` must match GitHub's exact casing.** GitHub's OIDC token `repository` claim is case-sensitive. If the repo owner has a capital letter (e.g. `Saeris`), use that — not the lowercase version. A casing mismatch causes a silent `ENEEDAUTH` failure.

To verify the registered entry:

```
npm trust list @scope/package
```

The `repository` field must exactly match what GitHub puts in the OIDC token.

### `repository.url` in `package.json` must also match

npm's sigstore provenance validator compares `repository.url` against the OIDC token claim. Lowercase vs capital mismatch produces a `422 Unprocessable Entity` error:

```
Error verifying sigstore provenance bundle: Failed to validate repository information:
package.json: "repository.url" is "git+https://github.com/saeris/repo.git",
expected to match "https://github.com/Saeris/repo" from provenance
```

Make sure `package.json` uses the correct casing:

```json
"homepage": "https://github.com/Owner/repo#readme",
"repository": {
  "type": "git",
  "url": "https://github.com/Owner/repo.git"
}
```

---

## 3. GitHub Actions Workflow

### Permissions must be at the workflow level

`id-token: write` must be declared at the **workflow level**, not just the job level. Job-level `permissions` blocks completely replace workflow-level ones rather than merging, and `workflow_dispatch` triggers may not inherit `id-token` correctly if it's only on the job.

```yaml
permissions:
  contents: write
  pull-requests: write
  id-token: write

jobs:
  release: ...
```

### Disable Yarn colors on the release step

Bumpy captures `yarn pack` stdout and uses it as the tarball file path. Yarn's ANSI color codes corrupt this path, causing `npm publish` to fail with `ENOENT` on a garbage path like `/path/to/[38;5;170m/path/to/package.tgz`. Disable color output:

```yaml
- run: vp dlx @varlock/bumpy ci release
  env:
    GH_TOKEN: ${{ github.token }}
    BUMPY_GH_TOKEN: ${{ secrets.BUMPY_GH_TOKEN }}
    NO_COLOR: "1"
    YARN_ENABLE_COLORS: "false"
```

`FORCE_COLOR: "0"` is insufficient — Yarn 4 may treat the string `"0"` as truthy. `YARN_ENABLE_COLORS: "false"` is the definitive Yarn 4 toggle.

### Exclude `CHANGELOG.md` from formatting

Bumpy generates `CHANGELOG.md` with its own formatting. Oxfmt (via `vp check`) will reject it. Exclude it in `vite.config.ts`:

```ts
fmt: {
  ignorePatterns: ["CHANGELOG.md"];
}
```

### Add `workflow_dispatch` for manual re-triggers

Publish steps can fail mid-run for infrastructure reasons (OIDC misconfiguration, casing issues, etc). Without `workflow_dispatch`, the only way to re-run is to push a `package.json` change. Add it with a filter bypass:

```yaml
on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  changes:
    outputs:
      version: ${{ steps.result.outputs.version }}
    steps:
      - uses: dorny/paths-filter@v4
        id: filter
        with:
          filters: |
            version:
              - 'package.json'
      - id: result
        run: echo "version=${{ github.event_name == 'workflow_dispatch' || steps.filter.outputs.version }}" >> $GITHUB_OUTPUT
```

### Gate the pack matrix on `package.json` changes

Bumpy only publishes when `package.json` has a new version. Running the full executable build matrix on every push to `main` is wasteful. Use `dorny/paths-filter` to skip it:

```yaml
pack:
  needs: changes
  if: needs.changes.outputs.version == 'true'
  ...

release:
  needs: [changes, pack]
  if: needs.changes.outputs.version == 'true'
  ...
```

---

## 4. Native Executable Builds (`@tsdown/exe`)

### Peer dependency workaround

`@tsdown/exe` peer-depends on `tsdown@0.22.0` exactly, but Vite+ bundles tsdown internally so the peer is unsatisfied. Fix with `yarn patch` to replace the two `tsdown/internal` imports with inline `node:fs/promises` equivalents. See `.yarn/patches/@tsdown-exe-npm-0.22.0-*.patch`.

### Use a native-platform matrix

Cross-platform builds fail on Linux — `@tsdown/exe` downloads the win-x64 Node binary as a `.zip` but tries to extract it with `tar`. Build natively on each platform instead:

```yaml
strategy:
  matrix:
    include:
      - runner: ubuntu-latest
        targets: linux-x64,linux-arm64
      - runner: macos-latest
        targets: darwin-x64,darwin-arm64
      - runner: windows-latest
        targets: win-x64
```

Pass targets via `PACK_TARGETS` env var and parse in `vite.config.ts`:

```ts
pack: {
  exe: {
    targets: process.env.PACK_TARGETS
      ? process.env.PACK_TARGETS.split(",").map((t) => {
          const [platform, arch] = t.split("-");
          return { platform, arch, nodeVersion: "26.1.0" };
        })
      : [{ platform: ..., arch: ..., nodeVersion: "26.1.0" }]
  }
}
```

Collect artifacts across runners and attach to the GitHub release:

```yaml
- uses: actions/upload-artifact@v7
  with:
    name: executables-${{ matrix.runner }}
    path: build/plxm-*

# In release job:
- uses: actions/download-artifact@v7
  with:
    pattern: executables-*
    path: build
    merge-multiple: true

- run: gh release upload "${TAG}" build/plxm-* --clobber
```

---

## 5. Monorepo Considerations (multiple packages)

- **Manual 1.0.0 publish is required for every package** before OIDC can be used — no shortcut.
- **Run `npm trust github` for each package** with exact casing. Check whether `@scope/*` wildcard trust is supported to avoid repetition.
- **Audit all `package.json` `repository.url` fields** for casing before wiring up CI — a mismatch on any package will cause that package's publish to fail.
- **`githubRelease: true` creates one release per package** by default. For a monorepo, consider `"githubRelease": { "enabled": true }` with aggregation to group all package releases into a single GitHub release per version run.
