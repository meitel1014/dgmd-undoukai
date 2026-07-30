# 旧 FitText → 最新 FitText 移行ガイド（dezifes-node 系プロジェクト向け）

> **用途**: dezifes-node をベースにした別プロジェクトで、古い `FitText` を
> このリポジトリ（ika-terrace-node）の最新版に差し替えるときの手順書。
> 他の Claude Code セッションにそのまま渡して使えるようにまとめている。

**前提**: `FitText.tsx` 本体はコピペで置き換える。本書は「呼び出し側（call site）と
周辺で直すべき点」のみを扱う。FitText 内部ロジックの詳細は対象外。

---

## 0. まず追加で必要な新規依存

最新 FitText は単体では動かない。ユーティリティを 1 つ**一緒にコピー**すること。

- `src/browser/utils/observeFitMeasure.ts` を新規作成（コピペ）
- FitText 内の import パスをプロジェクト構成に合わせる：
  `import { observeFitMeasure } from '../utils/observeFitMeasure';`
- 役割: `requestAnimationFrame` 直叩きだった測定を、**Typekit 等の遅延フォント適用を
  `ResizeObserver` で検知して測り直す**方式に変更したもの。これが無いとリロード毎に
  スケールがばらつく。

## 1. `overflow: hidden` の既定が消えた

- 旧版: コンテナ `<div>` に `overflow: 'hidden'` がハードコードされ、常にクリップしていた。
- 新版: これを**削除**。はみ出しは「実測して縮小＋高さ確定」で吸収する方針。
- **直す点**: レイアウトが FitText のクリップに依存していた箇所は、呼び出し側 or 親 CSS で
  `overflow: hidden` を明示的に付ける。多くの場合は縮小で収まるので不要だが、要確認。

## 2. コンテナ高さは JS が実測で上書きする

- 新版は `container.style.height = contentHeight * scale + 'px'` を実行時に**インラインで書き込む**。
- **直す点**:
  - FitText の要素自体に CSS/style で固定 `height` を与えても**実行時に上書きされる**。
    固定高さを効かせたいなら FitText ではなく**親要素**に付ける。
  - 縦フィット（下記 3）の制約は `container.parentElement.clientHeight` から読む。
    → **FitText の直接の親に確定した高さがあること**が縦縮小の前提。

## 3. 縦方向フィットが追加された

- 旧版: 横幅オーバーのみで縮小。
- 新版: 横幅に加え、**親の高さを超えたら縦にも縮小**（`Math.min` で両制約の厳しい方を採用）。
- **直す点**: 親に高さがある箇所では、旧版より小さく表示されうる。意図しない縮小が出たら、
  親の高さ指定を見直す（高さ制約を使いたくない場合は親を `height:auto` に）。

## 4. `white-space: nowrap` が強制になった ★最重要の破壊的変更

- 旧版: nowrap なし → **複数行に折り返せた**。
- 新版: inner span に `whiteSpace: 'nowrap'` を固定 → **常に 1 行**（幅が足りなければ
  折り返さず縮小）。
- **直す点**: 折り返し前提で FitText を使っていた箇所は表示が変わる。1 行縮小で問題ない箇所は
  そのままでよいが、**2 行表示・折り返しを意図していた箇所は FitText を使わない**か、別途対応が
  必要。`<br>` を含む HTML は `nowrap` でも `<br>` で改行される点に注意（自然折り返しだけが消える）。

## 5. `align` に `'center'` が追加（非破壊）

- `align?: 'left' | 'right'` → `'left' | 'right' | 'center'`。
- 既存呼び出しはそのままで可。中央寄せしたい箇所で `align="center"` が使える。

---

## 移行チェックリスト（呼び出し側）

1. [ ] `observeFitMeasure.ts` を配置し、import パスを合わせた
2. [ ] クリップ依存箇所に `overflow:hidden` を補った（必要時のみ）
3. [ ] FitText 自身に付けていた固定 `height` を**親要素**へ移動した
4. [ ] 折り返し前提だった箇所を洗い出し、1 行縮小で問題ないか確認した
5. [ ] 縦フィットで縮みすぎる箇所がないか、親の高さ指定を確認した
