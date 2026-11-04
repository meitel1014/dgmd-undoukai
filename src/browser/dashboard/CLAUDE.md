# Dashboard パネル構成

| Workspace | パネル | 表示名 | 幅 |
|---|---|---|---|
| エリア制限 | `area-limited-team-select` | エリア制限｜チーム選択 | 4 |
| エリア制限 | `area-limited-preview` | エリア制限｜プレビュー編集 | 8 |
| エリア無制限 | `area-unlimited-team-select` | エリア無制限｜チーム選択 | 4 |
| エリア無制限 | `area-unlimited-preview` | エリア無制限｜プレビュー編集 | 8 |
| ナワバリ | `turf-team-select` | ナワバリ｜チーム選択 | 4 |
| ナワバリ | `turf-preview` | ナワバリ｜プレビュー編集 | 8 |
| 設定 | `settings-csv-reload` | 設定｜チーム情報再読込 | 4 |

チームは単一プール（全種目共通）。選択チームは種目ごと（`selection[eventId]`）、勝利本数は全種目共有（`winCount`）。
選択されたチームはその種目の Graphic に即時反映され常時表示される（表示/非表示の切り替えは無い）。

## 実装パターン

- **種目別パネル**: `_shared/` コンポーネントに `eventId` を props で渡して `index.tsx` から直接 render する（薄いラッパー）。
- **独立パネル**（`settings-csv-reload`）: `index.tsx` + `App.tsx` の 2 ファイル構成。
- **`_shared/` ディレクトリ**: `index.tsx` がないためエントリとして認識されない。共通コンポーネント・CSS のみ配置。
- **HTML 生成**: `{name}/index.tsx` を置くとビルド時に `dashboard/{name}.html` が自動生成される。手動で HTML を書かない。`package.json` の `nodecg.dashboardPanels` への登録は手動。

## `_shared/` コンポーネントの実装メモ

- **TeamSelectPanel**: `selection[eventId]` の alpha/bravo を読み書きする。選択肢の表示は `team.name`。
- **PreviewEditPanel**: アルファ/ブラボーを単一 `<table>` で横並びにして行高を揃える（2 列グリッドでは編集行の高さがズレる）。スペーサー列（`preview-spacer-col`）でサイド間の空白を確保。
  - 編集可能な項目はチーム表示名（`viewname`、全種目共通）と、この種目の選手名（`rosters[eventId][i]`）。`updateTeam` の `patch.viewname` / `patch.player` で更新する（Enter 保存 / Escape 取消）。
  - 選択チームが変わったら編集中状態を破棄する。`useEffect` + `setState` ではなく、選択 ID を `key` にした内側コンポーネントの再マウントで実現している（`react-hooks/set-state-in-effect` 回避）。
  - 本数の ＋/− は `0〜WIN_TARGET` に収める（上限・下限でボタンを無効化）。
- **CSV アップロード**: `settings-csv-reload` パネルはファイル選択で `POST /upload-teams-csv` へ送信。`useReloadButton` フックで再読込ボタンの状態管理（`idle` / `loading` / `done` / `error`）を共通化。
- **スプレッドシート再読込**: 同パネルに「スプレッドシートから再読込」ボタンを併設（`reloadTeamsFromSheets` メッセージ）。失敗時は既存の `teamsPool` を変更しない。
