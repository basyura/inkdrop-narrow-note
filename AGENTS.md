# Repository Guidelines

## Plan

- 修正を始める前に計画をマークダウンファイルで .plans フォルダ配下に日本語で生成してください。
- 計画のファイル名は連番とし、1つ目を 001 始まりとして修正にあった適切なファイル名としてください。
- 具体的なファイル編集をする前に、修正案を提示すること。
- 指示があるまで新しい計画ファイルを作成せず、現在の計画に反映すること。
- API に関しては https://github.com/inkdropapp/api-docs/ サイトを確認すること。特に、inkdrop v5 から v6 への plugin アップデートに関しては https://github.com/inkdropapp/api-docs/blob/main/src/app/appendix/plugin-migration-from-v5-to-v6/page.mdx を参照すること。

## Project Structure & Module Organization
`lib/` contains the plugin runtime code. `lib/plugin.js` is the entry point registered by `package.json`, `lib/narrow-note-dialog.js` implements the modal search UI, and `lib/dropdown.js` defines the custom dropdown item renderer. Styles live in `styles/narrow-note.less`. Screenshots and documentation assets are stored in `images/`. There is currently no dedicated `test/` or `tests/` directory.

## Build, Test, and Development Commands
This package does not define npm scripts. Use the repository as a standard Inkdrop plugin:

```sh
npm install
ipm install
```

`npm install` installs local dependencies. `ipm install` installs the plugin into Inkdrop for manual verification. After changes, reload Inkdrop and exercise `narrow-note:open` and `narrow-note:openOnlyInBook`. Rebuild the note cache from the `cmd.rebuild` maintenance command when testing title changes.

## Coding Style & Naming Conventions
Source files use ES modules with React components and 2-space indentation. Follow the existing Prettier settings in `.prettierrc`: semicolons enabled, double quotes, trailing commas in ES5-compatible positions, and `printWidth: 100`. Keep filenames lowercase with hyphen-separated words such as `narrow-note-dialog.js`. Match the existing code style in this repository when naming commands, config keys, and CSS classes.

## Testing Guidelines
There is no automated test framework configured yet. Validate changes manually inside Inkdrop, focusing on modal open/close behavior, keyboard navigation, note filtering, Migemo dictionary loading, and completed-note display. When adding logic with meaningful branching, prefer introducing a small, isolated test setup rather than expanding unverified behavior.

## Commit & Pull Request Guidelines
Recent history follows short, imperative commit messages, often in a Conventional Commit style such as `fix(content): sort merged notes by updatedAt desc` or `perf(lib): cache lowercased note titles`. Keep commits scoped and descriptive. Pull requests should include the user-visible impact, manual verification steps, linked issues when relevant, and updated screenshots for UI changes under `images/` or in the PR body.

## Configuration Notes
Inkdrop 5.x is the supported host version. If you work on Migemo support, verify the `narrow-note.migemoDictPath` setting against a real dictionary file and confirm failure paths remain non-blocking.

Inkdrop v6 uses CodeMirror 6 in this project. `inkdrop.getActiveEditor()` returns a `CodeMirror#EditorView`, so do not assume an `editor.cm` property or use CodeMirror 5 APIs such as `markText`.
