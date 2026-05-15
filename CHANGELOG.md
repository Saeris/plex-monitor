# Changelog







## 1.1.0
<sub>2026-05-15</sub>

- Add background server support, stop command, already-running detection, and fix Windows console window and port default prompt

## 1.0.6
<sub>2026-05-15</sub>

- Fix malformed XML error when registering Windows Task Scheduler autostart — write UTF-16 BOM before task XML content

## 1.0.5
<sub>2026-05-15</sub>

- Inline all chunks into single dist/cli.mjs so npm install produces a self-contained executable

## 1.0.4
<sub>2026-05-15</sub>

- Run JS bundle build before npm publish so dist/cli.mjs is included in the package

## 1.0.3
<sub>2026-05-15</sub>

- Add shebang to JS bundle so npm global installs are executable on all platforms

## 1.0.2
<sub>2026-05-15</sub>

- Fix bin entries pointing at source TypeScript instead of built output; add JS bundle for npm/npx install path

## 1.0.1
<sub>2026-05-15</sub>

- Test release flow
