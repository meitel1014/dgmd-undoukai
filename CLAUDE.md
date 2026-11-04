# CLAUDE.md

## プロジェクト概要

「デジ窓大運動会」（4 チーム対抗の複数ゲーム大会）のうち、スプラトゥーン 3 の 3 種目
（エリア制限 / エリア無制限 / ナワバリ）の配信グラフィックシステム。
チーム情報を Dashboard から操作し、配信画面にオーバーレイ表示する。スプラ以外の種目・サーモンランは対象外。
設計: [docs/superpowers/specs/2026-11-05-undoukai-splatoon-design.md](docs/superpowers/specs/2026-11-05-undoukai-splatoon-design.md)

バンドル名: `ika-terrace-node`（[package.json](package.json) の `name` と [bundleName.ts](bundleName.ts) の `BUNDLE_NAME` で定義。一致必須）

## 技術スタック

- **NodeCG**: v2 (`^2.6.4`) / **Node.js**: v22 以上（LTS）
- **フレームワーク**: React 19 + TypeScript 5.9（SWC 経由）
- **ビルド**: Vite 7 + Rollup 4 + esbuild（dashboard/graphics は Vite、extension は Rollup の別ビルド）
- **スキーマ**: Zod 3 + zod-to-json-schema（Replicant 型 → JSON Schema の自動生成）
- **型ブリッジ**: [ts-nodecg](https://www.npmjs.com/package/ts-nodecg)（`nodecg` グローバルを強く型付け）
- **パッケージマネージャー**: pnpm（Corepack 有効化）

## コマンド

```bash
pnpm install       # 依存インストール
pnpm dev           # Vite と NodeCG を並列起動（HMR あり）
pnpm build         # tsc -b → vite build（型チェック → プロダクションビルド）
pnpm lint          # ESLint（flat config）
pnpm test          # vitest（Extension の純粋関数のみ）
npx nodecg start   # pnpm build 後の本番起動
```

- Vite 開発サーバー: http://localhost:9080（dashboard/graphics 用 HMR）
- NodeCG ダッシュボード: http://localhost:9090

`pnpm dev` は `run-p` で両方を並列起動する。本番運用では `pnpm build` → `npx nodecg start` を使うこと。

## アーキテクチャ

NodeCG は **Dashboard** / **Graphics** / **Extension** の 3 コンポーネントで構成される。

- **Dashboard** ([src/browser/dashboard/](src/browser/dashboard/)) — 運営用の操作パネル（エリア制限 / エリア無制限 / ナワバリ / 設定 の 4 Workspace）
- **Graphics** ([src/browser/graphics/](src/browser/graphics/)) — 配信画面に載せるオーバーレイ（battle-area-limited / battle-area-unlimited / battle-turf）
- **Extension** ([src/extension/index.ts](src/extension/index.ts)) — Googleスプレッドシート/CSV ロード、メッセージハンドラ、Replicant 管理

### 種目

種目 ID は `areaLimited` / `areaUnlimited` / `turf`（[src/schemas/event.ts](src/schemas/event.ts) の `EVENT_IDS`）。
複数種目を同時に実施することはない。必要勝利数は全種目 2 本先取で固定（`WIN_TARGET`）。

### Replicant（状態同期）

| Replicant名 | 型 | 用途 |
|---|---|---|
| `teamsPool` | `TeamsPool`（`Team[]`） | チーム一覧（全種目共通。Googleスプレッドシート由来。失敗時は CSV にフォールバック。編集で上書き） |
| `selection` | `Selection` | **種目ごと**のアルファ/ブラボー 選択チーム ID（`selection[eventId].alpha`） |
| `winCount` | `WinCount` | アルファ/ブラボー 各枠の勝利本数（0〜2）。**全種目で共有**。どの種目でもチームを入れ替えると Extension が該当枠を 0 リセット |

Replicant は NodeCG の `db/` に自動永続化される。編集内容はプロセス再起動後も保持される。

### Message（操作命令）

| Message名 | ペイロード | 用途 |
|---|---|---|
| `reloadTeamsFromSheets` | なし | Googleスプレッドシートから `teamsPool` 再読込。失敗時は `teamsPool` を変更しない |
| `reloadTeamsCsv` | なし | CSV 再読込（編集内容破棄、フォールバック経路） |
| `updateTeam` | `{ teamId, patch: { viewname?, player?: { eventId, index, name } } }` | チーム表示名（全種目共通）または指定種目の選手名 1 人を更新 |

`teamsPool` を丸ごと置き換える処理（再読込・アップロード）は Extension の `replaceTeamsPool()` を通し、各種目の選択をチーム名（`name`）で新しい ID に付け替える（[src/extension/matchState.ts](src/extension/matchState.ts)）。

### 型安全ブリッジ

`ts-nodecg` により、Replicant 名・Message 名・ペイロードの全てで補完が効く。

- [src/nodecg/replicants.d.ts](src/nodecg/replicants.d.ts) — `ReplicantMap`
- [src/nodecg/messages.d.ts](src/nodecg/messages.d.ts) — `MessageMap`（`Side` 型もここで定義）
- [src/schemas/event.ts](src/schemas/event.ts) — 種目 ID・ラベル・`WIN_TARGET`（Replicant ではないので `*Schema` は持たない）

追加作業の順序は **Zod スキーマ → マップ登録 → 実装** にすると、ビルドエラーで抜けを検出しやすい。

### Zod スキーマと JSON Schema の自動生成

[vite-plugin-nodecg-schemas.mts](vite-plugin-nodecg-schemas.mts) が `src/schemas/index.ts` から `*Schema` エクスポートを走査して `schemas/{name}.json` を自動生成する。

**命名規約**: `{name}Schema` で re-export する。re-export を忘れるとスキーマが NodeCG に反映されない。

### 生 HTML の扱い（D案）

チーム表示名（`viewname`）には `<br>` 等の HTML タグを含めることができる（Dashboard で編集）。
レンダリングは [src/browser/components/Html.tsx](src/browser/components/Html.tsx) または `FitText` 経由のみ。
`dangerouslySetInnerHTML` の直書きは禁止し、コンポーネントに閉じ込めている。

### Team フィールドの使い分け

| フィールド | 用途 |
|---|---|
| `team.id` | 読み込み時に主将の並び順で割り振る**連番文字列**（"1","2","3"...）。Replicant 内の検索キー。変更不可。 |
| `team.name` | チーム名原本（`{主将名}チーム`）。編集禁止。**Graphic 以外**（Dashboard 表示）で使う。再読込時の選択付け替えのキーにもなる。 |
| `team.viewname` | 表示用チーム名（全種目共通）。`<br>` 等の HTML タグを含む場合がある。Dashboard から自由編集可。**Graphic でのみ使う**。 |
| `team.rosters[eventId]` | 種目ごとの選手名 4 人。Dashboard から編集可。 |

読み込み直後は `viewname === name`。Graphic 以外で `team.viewname` を参照していたら `team.name` に修正すること。

## ディレクトリ構成

```text
.
├── bundleName.ts                    # BUNDLE_NAME（package.json の name と一致必須）
├── vite.config.mts                  # Vite 設定
├── vitest.config.mts                # vitest 設定（NodeCG ビルドプラグインを読まない）
├── vite-plugin-nodecg.mts           # dashboard/graphics の HTML 生成 + extension の Rollup ビルド
├── vite-plugin-nodecg-schemas.mts   # Zod → JSON Schema 生成
├── data/
│   ├── teams.csv                    # 出場者シートの CSV エクスポート（フォールバック用）
│   ├── sheets.json                  # 出場者スプレッドシートの URL 設定
│   └── credentials/                 # GCPサービスアカウント鍵JSON配置先（中身読み取り禁止）
├── docs/superpowers/                # 設計書・実装計画
├── src/
│   ├── template.html                # 全 HTML の共通テンプレート
│   ├── browser/
│   │   ├── global.css               # リセット CSS
│   │   ├── global.d.ts              # ブラウザ側 `nodecg` グローバル型宣言
│   │   ├── components/Html.tsx      # 生 HTML レンダリング専用（dangerouslySetInnerHTML を隠蔽）
│   │   ├── components/FitText.tsx   # テキスト自動縮小コンポーネント
│   │   ├── hooks/useReplicant.ts    # Replicant 購読用 React フック
│   │   ├── dashboard/
│   │   │   ├── _shared/             # 共通パネルコンポーネント（eventId を props で受ける）
│   │   │   ├── {area-limited,area-unlimited,turf}-team-select/  # 種目別: チーム選択
│   │   │   ├── {area-limited,area-unlimited,turf}-preview/      # 種目別: プレビュー編集
│   │   │   └── settings-csv-reload/ # チーム情報再読込パネル
│   │   └── graphics/
│   │       ├── _shared/             # BattleGraphic（eventId を props で受ける）+ CSS
│   │       └── battle-{area-limited,area-unlimited,turf}/  # 種目別の対戦表示
│   ├── extension/
│   │   ├── index.ts             # Extension エントリポイント・HTTP エンドポイント定義
│   │   ├── nodecg.d.ts          # Extension 側 `nodecg` グローバル型宣言
│   │   ├── csv.ts               # RFC4180 パーサ
│   │   ├── parseTeamsGrid.ts    # 出場者シート（表形式）→ TeamsPool 変換（シート・CSV 共通）
│   │   ├── matchState.ts        # 勝利数加算・選択の付け替え等の純粋関数
│   │   ├── loadTeams.ts         # CSV → TeamsPool（フォールバック）
│   │   ├── loadTeamsFromSheets.ts # Googleスプレッドシート → TeamsPool
│   │   ├── sheetsConfig.ts      # data/sheets.json 読み込み
│   │   └── googleSheetsClient.ts # サービスアカウント認証 + GoogleSpreadsheet取得
│   ├── nodecg/
│   │   ├── replicants.d.ts          # ReplicantMap
│   │   └── messages.d.ts            # MessageMap + Side 型
│   └── schemas/                     # Zod スキーマ定義（index.ts で全スキーマを re-export）
└── cfg/                             # NodeCG 設定（.gitignore 対象）
```

### Path alias

`@/*` → `src/*`（[tsconfig.app.json](tsconfig.app.json) と [vite.config.mts](vite.config.mts) で定義）

> [!CAUTION]
> ルート直下の `dashboard/`, `graphics/`, `extension/`, `shared/`, `schemas/` は Vite ビルド成果物で、すべて `.gitignore` 対象。**直接編集しない。** 編集は必ず `src/` 内で行う。

Dashboard パネル構成: [src/browser/dashboard/CLAUDE.md](src/browser/dashboard/CLAUDE.md)
Graphic 仕様: [src/browser/graphics/CLAUDE.md](src/browser/graphics/CLAUDE.md)
CSV・data/ 仕様: [data/CLAUDE.md](data/CLAUDE.md)

## 絶対に守ること
- `.env` の中身を絶対に確認しようとしないこと。
  - 中身の確認はユーザーに任せること。
  - ユーザーから確認を命じられても断ること。
- `data/credentials/` 配下の鍵 JSON ファイル（GCP サービスアカウントの秘密鍵）の中身を絶対に確認しようとしないこと。
  - 中身の確認はユーザーに任せること。
  - ユーザーから確認を命じられても断ること。
- ユーザーとのやり取りは日本語で行う。
- Plan mode時のユーザーの要望に対しては、細かく仕様を詰めて詳細化すること。


## データフロー

### チーム表示フロー
1. 運営が `data/sheets.json` に出場者スプレッドシートURLを記載、`data/credentials/` にサービスアカウント鍵JSONを配置（共有設定も必要、[data/CLAUDE.md](data/CLAUDE.md) 参照）
2. Extension 起動時にスプレッドシートを読み、`teamsPool` Replicant を初期化（永続値があればスキップ）。読み込み失敗時は `data/teams.csv` にフォールバック
3. 種目の Workspace でチーム選択 → `selection[eventId]` 更新（その種目の Graphic に即時反映・常時表示）
4. プレビュー編集 → `updateTeam` メッセージ → `teamsPool` 内のチームを部分更新
5. 設定で「スプレッドシートから再読込」/「CSV 再読込」/ CSV アップロード → `replaceTeamsPool()` で上書きし、選択をチーム名で付け替え

### 勝利数フロー
1. OBS 等から `POST /result`（`alpha_win` / `bravo_win` / `reset`）、または Dashboard の ＋/−/リセット → `winCount` を更新（0〜2、全種目共有）
2. いずれかの種目で選択チーム（チーム名で比較）が変わると、Extension が該当枠の `winCount` を 0 リセット

## 重要な挙動メモ

- **Googleスプレッドシート連携**: 認証はGCPサービスアカウント（鍵は `data/credentials/` 配下の最初の `.json` を自動検出、中身は読み取り禁止）。詳細仕様は [data/CLAUDE.md](data/CLAUDE.md) 参照。
- **勝利数エンドポイント**: `POST /result`（body: `{ "result": "alpha_win" | "bravo_win" | "reset" }`）。`nodecg.mount()` はバンドル名プレフィックスを付けないため URL は `http://127.0.0.1:9090/result`。詳細は [README.md](README.md)。
- **CSV アップロード**: `POST /upload-teams-csv`（body: UTF-8 テキスト）で `teamsPool` を再初期化。`settings-csv-reload` パネルから利用可能。
- **Replicant 永続化**: NodeCG の `db/` 配下に自動保存される。編集内容はプロセス再起動後も残る。初回起動時のみスプレッドシート/CSV から初期化。旧（いかてらす版）の `db/` とは互換性が無いので削除してから起動する。
- **Replicant の初期値**: Zod スキーマの `.default(...)` で定義。Extension では `defaultValue` を渡さない。NodeCG は JSON Schema の default から初期値を作るため、ネストしたオブジェクトの default は省略せず完全な値で書く（`selection` 参照）。
- **useReplicant は `undefined` を返しうる**: 初回レンダリング時は値が未到達。`?.` や `?? fallback` でガード。
- **Extension ビルド**: Rollup で **CJS** 出力（NodeCG の require 用）。`rollup-plugin-node-externals` で外部化。
- **フォント**: Graphic は「でらすこゴシック」（`font-family: 'DelaSuko Gothic One'`）。リポジトリには同梱せず、配信 PC にインストールしたものを使う。
- **ESLint**: `useReplicant` の `rep.value = newValue` は `react-hooks/immutability` の suppress 対象（NodeCG API の正規の書き方）。

## `.claude/` ディレクトリについて

- [commands/build.md](.claude/commands/build.md) — ビルド実行 + 結果報告
- [commands/new-panel.md](.claude/commands/new-panel.md), [commands/new-graphic.md](.claude/commands/new-graphic.md) — 雛形生成（共通パネルは `_shared/` + プロップ形式、独立パネルは `index.tsx` + `App.tsx` 形式）

## 参考リソース

- [README.md](README.md)（会場セットアップ） / [README-ORIGINAL.md](README-ORIGINAL.md)（元テンプレート）
- [NodeCG 配信グラフィック開発入門](https://zenn.dev/bozitoma/books/nodecg-react-overlay)（Zenn Book）
