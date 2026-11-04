# Dashboard パネル構成

| Workspace | パネル | 表示名 | 幅 |
|---|---|---|---|
| 大運動会 | `battle-event-select` | 種目選択 | 4 |
| 大運動会 | `battle-team-select` | チーム選択 | 4 |
| 大運動会 | `battle-preview` | プレビュー編集 | 8 |
| 設定 | `settings-csv-reload` | 設定｜チーム情報再読込 | 4 |

チームは単一プール（全種目共通）。選択チームは種目ごと（`selection[eventId]`）、勝利本数は全種目共有（`winCount`）。
進行中の種目は `currentEvent`（種目選択パネル）。チーム選択・プレビュー編集は `currentEvent` の種目を扱う。
選択されたチームは battle Graphic に即時反映され常時表示される（表示/非表示の切り替えは無い）。

## 実装パターン

- **Battle パネル**（`battle-team-select` / `battle-preview`）: `_shared/` コンポーネントを `index.tsx` から直接 render する（薄いラッパー）。
- **独立パネル**（`battle-event-select` / `settings-csv-reload`）: `index.tsx` + `App.tsx` の 2 ファイル構成。
- **`_shared/` ディレクトリ**: `index.tsx` がないためエントリとして認識されない。共通コンポーネント・CSS のみ配置。
- **HTML 生成**: `{name}/index.tsx` を置くとビルド時に `dashboard/{name}.html` が自動生成される。手動で HTML を書かない。`package.json` の `nodecg.dashboardPanels` への登録は手動。

## `_shared/` コンポーネントの実装メモ

- **種目選択**（`battle-event-select`）: `.toggle-btn` のトグルで `currentEvent` を直接書き込む。
- **TeamSelectPanel**: `currentEvent` を読み、`selection[currentEvent]` の alpha/bravo を読み書きする。選択肢の表示は `team.name`。
- **PreviewEditPanel**: アルファ/ブラボーを単一 `<table>` で横並びにして行高を揃える（2 列グリッドでは編集行の高さがズレる）。スペーサー列（`preview-spacer-col`）でサイド間の空白を確保。
  - 編集可能な項目はチーム表示名（`viewname`、全種目共通）と、この種目の選手名（`rosters[eventId][i]`）。`updateTeam` の `patch.viewname` / `patch.player` で更新する（Enter 保存 / Escape 取消）。
  - 種目・選択チームが変わったら編集中状態を破棄する。`useEffect` + `setState` ではなく、種目と選択 ID を `key` にした内側コンポーネントの再マウントで実現している（`react-hooks/set-state-in-effect` 回避）。
  - 本数の ＋/− は `0〜WIN_TARGET` に収める（上限・下限でボタンを無効化）。
- **CSV アップロード**: `settings-csv-reload` パネルはファイル選択で `POST /upload-teams-csv` へ送信。`useReloadButton` フックで再読込ボタンの状態管理（`idle` / `loading` / `done` / `error`）を共通化。
- **スプレッドシート再読込**: 同パネルに「スプレッドシートから再読込」ボタンを併設（`reloadTeamsFromSheets` メッセージ）。失敗時は既存の `teamsPool` を変更しない。
