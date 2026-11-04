# Graphic 仕様

全 Graphic は 1920×1080、**背景は透過**。枠・ロゴのレイアウト画像は OBS の下レイヤーに敷き、Graphic は文字だけを重ねる。

| Graphic | 用途 |
|---|---|
| `battle` | 対戦表示（`currentEvent` の種目の対戦カード） |

中身は `_shared/BattleGraphic.tsx` をマウントするだけの薄いエントリ。`BattleGraphic` が `currentEvent` を読み、その種目で描画する。

## BattleGraphic の表示要素（座標は `_shared/battle.css`）

| 要素 | 位置 | 内容 |
|---|---|---|
| 選手名 ×4（左右） | 黒バー 4 本（上端 680 / 752 / 824 / 896px、高さ 66px）。アルファは左揃え `left: 50px`、ブラボーは右揃え `right: 45px` | `team.rosters[eventId]`。`FitText` で幅 320px に自動縮小 |
| チーム名（左右） | 下段の大きい黒バー（y 980〜1080）。アルファ x 75〜540、ブラボー x 1380〜1845、中央揃え | `team.viewname`（`FitText`） |
| 勝利本数（左右） | 黄 / 青アクセント部分（中心 x 640 / 1280、y 1028）、`#333` | `winCount`（全種目共有） |

- `selection[eventId]` からチームを取得（`_shared/useTeamData.ts` の `useTeamData(eventId, side)`）。未選択の側は何も描かない。
- フォントは「でらすこゴシック」。リポジトリには同梱せず、配信 PC にインストールしたものを使う。サブファミリー名が "R" のため Windows の Chrome / OBS ではファミリー名（`'DelaSuko Gothic One'`）で解決できない。`@font-face` の `local('DelaSuko Gothic One Regular'), local('DelaSukoGothicOne-R')` で `'DelaSukoGothic'` という別名を付けて使う。
- 文字は白一色で縁取り無し。座標・見た目の微調整は手動で行う。

## 実装パターン

- **HTML 生成**: `{name}/index.tsx` を置くとビルド時に `graphics/{name}.html` が自動生成される。手動で HTML を書かない。`package.json` の `nodecg.graphics` への登録は手動。
- **`_shared/` ディレクトリ**: graphics 共通コンポーネント + CSS を配置。`index.tsx` がないためエントリ扱いされない。
