# Inkdrop v6 対応計画

## 対応状況

- [x] 現状エラーの把握
- [x] v6 対応方針の整理
- [x] `semantic-ui-react` 依存箇所の詳細洗い出し
- [x] UI 置き換え方針の最終決定
- [x] `lib/narrow-note-dialog.js` の置き換え実装
- [x] `lib/dropdown.js` の見直し
- [x] `styles/narrow-note.less` の調整
- [ ] Inkdrop v6 API への追従
- [ ] 手動確認
- [x] 入力時パフォーマンス改善

## 背景

- `package.json` の `engines.inkdrop` は `^6.0.0` に更新済み
- 現状、`narrow-note:open` 実行時に `ReactDOM.findDOMNode is not a function` でクラッシュする
- エラースタックと実装から、`semantic-ui-react@0.88.2` の `Dropdown` が React 19 系で非推奨ではなく削除済みの `findDOMNode` に依存している可能性が高い

## 参照

- Inkdrop API Docs: Plugin Migration Guide from v5 to v6
  - `@electron/remote` 廃止
  - `inkdrop.main.dataStore.getLocalDB()` は `inkdrop.localDB` へ移行
- リポジトリ現状
  - `lib/narrow-note-dialog.js` で `semantic-ui-react` の `Dropdown` を使用
  - `lib/plugin.js` でモーダル登録
  - `lib/dropdown.js` で候補行を描画

## 対応方針

1. `findDOMNode` 依存の除去を最優先とする
   - `semantic-ui-react` の `Dropdown` 継続利用は避ける
   - Inkdrop v6 / React 19 環境で安全に動く入力 UI に置き換える
2. v5 由来 API の棚卸しを同時に進める
   - `inkdrop.main.dataStore.getLocalDB()` を `inkdrop.localDB` ベースに更新する
   - そのほか v6 で非推奨・削除された呼び出しがないか確認する
3. 既存機能の挙動はなるべく維持する
   - ノート絞り込み
   - ブック限定検索
   - キーボード操作
   - 完了ノート表示
   - Migemo 辞書利用

## 実施ステップ

### 1. 影響範囲の特定

- [x] `semantic-ui-react` 依存箇所を洗い出す
- [x] `Dropdown.SearchInput` / `onChange` / `search` / `selectOnNavigation` に依存している現在の振る舞いを整理する
- [x] `inkdrop.main.dataStore.getLocalDB()` を含む v5 API の使用箇所を洗い出す

#### `semantic-ui-react` 依存箇所の調査結果

- `package.json`
  - `semantic-ui-react@0.88.2` に依存している
- `lib/narrow-note-dialog.js`
  - `Dropdown` を import している唯一の実装箇所
  - `<Dropdown>` 本体をモーダル内で描画している
  - `search` prop に `searchNotes` を渡し、検索ロジックを `Dropdown` の拡張ポイントに載せている
  - `onChange` でノート選択完了を処理している
  - `searchInput` に `<Dropdown.SearchInput>` を渡し、独自キー処理を差し込んでいる
  - `ref={dropdownRef_}` で `clearSearchQuery()` を呼び出しており、`Dropdown` インスタンス API に依存している
- `styles/narrow-note.less`
  - `.narrow-note-dropdown`
  - `.narrow-note-dropdown div.menu`
  - `.narrow-note-dialog div[role="combobox"]`
  - 上記のように `Dropdown` の DOM 構造前提のスタイルがある
- `lib/dropdown.js`
  - `semantic-ui-react` 自体には依存していない
  - ただし `Dropdown` の候補 `content` として使われているため、候補リスト描画の置き換え対象に含まれる

#### `Dropdown` 依存の振る舞い整理

- 検索入力
  - `searchInput` に `<Dropdown.SearchInput>` を渡している
  - `onKeyDown` で独自キー操作を追加している
  - モーダル表示後に `.narrow-note-dropdown input` を直接探して focus している
- 検索実行
  - `search={searchNotes}` で `Dropdown` 側の検索フックに処理を委譲している
  - 2 文字未満では初期候補をそのまま返す
  - 2 文字以上では `allNotes_` を対象に絞り込み、Migemo 正規表現とスペース区切り AND 検索を行う
  - `mode_ === "book"` の場合は現在ブックに限定する
- 候補描画
  - `options` に `content: <CustomDropdownItem />` を渡している
  - 初期表示候補と検索後候補の両方で `CustomDropdownItem` を使っている
- 候補選択
  - `onChange={handleOnChange}` に依存している
  - 選択時はダイアログを閉じ、`core:open-note` を dispatch する
  - 特殊項目 `narrow-note:cmd.rebuild` はノートを開かずキャッシュ再構築トリガとして扱う
- キーボード操作
  - `ArrowUp` / `ArrowDown` で候補移動後にアクティブ項目のスクロール位置を補正している
  - `Escape` で閉じる
  - `Space` は入力欄に渡すため伝播停止している
  - `Backspace` / `Ctrl-h` で `filteredNotes_` をリセットしている
  - `Ctrl-w` で `dropdownRef_.current.clearSearchQuery()` を呼び、検索語を全消去している
  - `Ctrl-n` / `Ctrl-p` で疑似的に上下キーイベントを投げ、候補移動させている
- `Dropdown` インスタンス API 依存
  - `dropdownRef_` を使って `clearSearchQuery()` を直接呼んでいる
  - これは独自実装に置き換える場合、検索語 state の明示管理に置き換える必要がある
- DOM 構造依存
  - `.menu.visible` と `.selected.item` を前提にアクティブ項目を探している
  - 置き換え後はアクティブ index または要素 ref を持つ実装へ変更が必要

#### v5 API 使用箇所の調査結果

- [lib/narrow-note-dialog.js](/Users/tatsuya/repos/inkdrop/narrow-note/lib/narrow-note-dialog.js)
  - `inkdrop.main.dataStore.getLocalDB()` を 1 箇所で使用している
  - 用途はノート一覧取得、ブック内ノート取得、completed ノート取得
  - v6 では `inkdrop.localDB` へ置き換える必要がある
- 今回の調査範囲では、以下の v5 系 API は未使用
  - `@electron/remote`
  - `inkdrop.window.on(...)`
  - `editor.cm`
  - `markText`
- したがって、v6 対応の API 影響は現時点では `localDB` 移行が主対象

### 2. UI 置き換え案の決定

- [x] ~~候補 A: Inkdrop 標準コンポーネントで置き換える~~
- [x] 候補 B: プレーンな React 実装に置き換える
- [x] 今回は互換性と保守性を優先し、`semantic-ui-react` を外したシンプルな独自実装を第一候補とする

#### UI 方針の決定

- 今回はプレーンな React による独自実装で進める
- `Dialog` は継続利用し、その内部の検索入力と候補リストを置き換える
- `semantic-ui-react` の `Dropdown` は撤去対象とする
- 検索語、表示候補、アクティブ項目は React state で明示管理する
- 既存のキーボード操作と候補描画は可能な限り維持する

### 3. ダイアログ実装の置き換え

- [x] [lib/narrow-note-dialog.js](/Users/tatsuya/repos/inkdrop/narrow-note/lib/narrow-note-dialog.js)
  - [x] 検索入力欄を通常の input に置き換える
  - [x] 候補リストを独自描画に置き換える
  - [x] 上下キー、Enter、Escape、`Ctrl-n`、`Ctrl-p`、`Ctrl-w` など既存キーバインドを維持する
  - [x] アクティブ項目のスクロール追従を独自制御にする
  - [x] `narrow-note:open` の初回起動が安定するようコマンド登録方法を見直す
  - [x] 入力ごとの全件再計算を減らし、検索結果を state 管理にして入力時の固まりを軽減する
- [x] [lib/dropdown.js](/Users/tatsuya/repos/inkdrop/narrow-note/lib/dropdown.js)
  - [x] 候補行コンポーネントとして再利用可能であることを確認し、今回は props 変更なしで継続利用する
- [x] [styles/narrow-note.less](/Users/tatsuya/repos/inkdrop/narrow-note/styles/narrow-note.less)
  - [x] 既存 `.narrow-note-dropdown` 前提のスタイルを新 UI に合わせて更新する
  - [x] 絞り込み中に位置が動かないようダイアログ上端位置を固定する
  - [x] v6 向けに `styles/narrow-note.css` へ移行し、ネスト依存を減らすためフラットな CSS に調整する
  - [x] 選択行の背景色は `var(--note-list-view-item-active-background)` を使うよう確認する

### 4. Inkdrop v6 API への追従

- [x] `inkdrop.main.dataStore.getLocalDB()` を `inkdrop.localDB` に置き換える
- [ ] DB API の戻り値形式が同じか確認し、差異があれば吸収する
- [ ] モーダル表示やコマンド登録周辺で v6 非互換がないか確認する

### 5. 手動確認

- [x] `narrow-note:open` でクラッシュしない
- [ ] `narrow-note:openOnlyInBook` が現在ブックに限定される
- [x] 初期表示件数、絞り込み、Enter でノートを開く動作が維持される
- [x] キーボード操作で候補移動できる
- [x] 完了ノート表示と Migemo 検索が機能する
- [x] `cmd.rebuild` 相当の導線が維持される

#### 手動確認メモ

- `narrow-note:open` は起動可能になり、`ReactDOM.findDOMNode is not a function` は再現しなくなった
- `ctrl-r` による起動は改善済み
- ダイアログの初期表示位置ずれと、絞り込み時の縦位置変動は改善済み
- 検索結果の再計算タイミングを見直し、入力時のフリーズを軽減する修正を実施
- `debounce`、`startTransition`、正規表現生成削減により、入力時パフォーマンスは改善した
- `Ctrl-n` / `Ctrl-p` はコード上は実装されているが、実機での動作確認は未完了
- 選択行の背景色変数は `--selected-background` ではなく `--note-list-view-item-active-background` が有効だった
- 初期表示件数、絞り込み、Enter によるノートオープンは動作確認済み
- キーボード操作による候補移動は動作確認済み
- completed ノート表示と Migemo 検索は動作確認済み
- `cmd.rebuild` は全件検索用キャッシュ再構築の手動導線として現状維持とする
- `narrow-note:openOnlyInBook` は対象ブックに絞られない状況が残っているが、優先度が低いため現状維持とする

### 6. 入力時パフォーマンス改善

- [x] `debounce` を入れて、入力直後の毎回検索を避ける
- [x] `startTransition` で検索結果更新を低優先度にする
- [x] `jsm.query()` と `RegExp` 生成を検索語ごと 1 回に減らす
- [x] ~~改善後も重い場合のみ Worker 化を再検討する~~

#### 方針メモ

- 検索漏れを避けるため、検索対象件数は削らない
- 表示件数制限は必要なら描画コスト対策として別途検討するが、検索対象の打ち切りには使わない
- まずはメインスレッドの実装改善で追い込み、Worker 化は行わない

## 想定リスク

- `semantic-ui-react` 依存除去により、候補選択時の微妙なキーボード挙動が変わる可能性がある
- `inkdrop.localDB` への移行で検索 API の呼び出しシグネチャ差分がある可能性がある
- 現在の実装は関数コンポーネント内に再レンダーで失われるローカル変数を持っているため、v6 対応の過程で状態管理の見直しが必要になる可能性がある

## 先に確認したい点

- `semantic-ui-react` の更新で回避するのではなく、依存自体を外す前提で進める
- まずはクラッシュ解消と主要導線維持を優先し、見た目の完全一致は二段階目にする
