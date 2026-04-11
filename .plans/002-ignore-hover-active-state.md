# ホバー時のアクティブ項目固定計画

## 対応状況

- [x] 原因箇所の特定
- [x] 修正方針の決定
- [x] `lib/narrow-note-dialog.js` の修正
- [ ] 手動確認

## 背景

- ノート一覧の候補行にマウスカーソルを乗せると、その行がアクティブ項目として着色される
- 要件は、マウスカーソル位置を無視し、アクティブ項目をキーボード操作と初期選択だけで管理すること

## 対応方針

- 候補行ホバーで `activeIndex_` を更新しない
- クリックによるノート選択は維持する
- 追加の `:hover` スタイルは入れず、まずはイベント削除のみで解消する

## 実施内容

- [x] [lib/narrow-note-dialog.js](/Users/tatsuya/repos/inkdrop/narrow-note/lib/narrow-note-dialog.js)
  - [x] 候補行の `onMouseEnter={() => setActiveIndex(index)}` を削除する
  - [x] `activeIndex_` の更新元が初期選択とキーボード操作のみであることを確認する

## 手動確認項目

- [ ] 候補リスト上でマウスを動かしてもアクティブ色が移動しない
- [ ] `ArrowUp` / `ArrowDown` / `Ctrl-n` / `Ctrl-p` で従来どおり候補移動できる
- [ ] マウスクリックで候補選択できる
