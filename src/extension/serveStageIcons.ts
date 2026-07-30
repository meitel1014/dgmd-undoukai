import fs from 'node:fs';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import sharp from 'sharp';

const STAGE_ICON_DIR = path.resolve(process.cwd(), 'data/stage_icon');
// 該当ステージのアイコンが無い場合のフォールバック。
const NOT_FOUND_FILE = 'S3_Stage_Not_Found.png';

// 拡張子 → Content-Type。未知の拡張子は octet-stream で配信する。
const CONTENT_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

type Log = { warn(...args: unknown[]): void };

type Options = {
  /** 指定すると sharp でこの幅に高品質縮小して配信する（ブラウザ側の粗い縮小を回避） */
  resizeWidth?: number;
};

// リサイズ結果のメモリキャッシュ（キー: resolved:mtimeMs:width）。
// ステージ画像は数十枚と少なく静的なので全件常駐で問題ない。
const resizeCache = new Map<string, Buffer>();

/**
 * data/stage_icon/{ステージ名}.png を配信する簡易静的ミドルウェア。
 *
 * cast アイコン（serveCastIcons.ts）と同様、ファイル名が日本語かつ拡張子が不定のため、
 * リクエストされた名前（拡張子なし・URLエンコード済み）に対しディレクトリを走査し、
 * 「拡張子を除いた basename が一致する最初のファイル」を配信する。
 * 一致が無い場合は S3_Stage_Not_Found.png をフォールバック配信する。
 *
 * options.resizeWidth を指定すると、sharp（Lanczos）で高品質に縮小した PNG を返す。
 * 元画像が 1920×1080 と大きく、表示は小さいため、ブラウザ縮小のジャギーを避けるのに使う。
 */
export function createStageIconMiddleware(log: Log, dir: string = STAGE_ICON_DIR, options: Options = {}) {
  const { resizeWidth } = options;
  return async (req: IncomingMessage, res: ServerResponse) => {
    if (req.method !== 'GET') {
      res.statusCode = 405;
      res.end();
      return;
    }

    const rawPath = (req.url ?? '').split('?')[0];
    let decoded: string;
    try {
      decoded = decodeURIComponent(rawPath);
    } catch {
      res.statusCode = 400;
      res.end();
      return;
    }

    // path.basename でパス区切りを除去し、パストラバーサルを防ぐ。
    const name = path.basename(decoded);
    if (!name || name === '.' || name === '..') {
      res.statusCode = 400;
      res.end();
      return;
    }

    let entries: string[];
    try {
      entries = fs.readdirSync(dir);
    } catch (e) {
      log.warn('[serveStageIcons] ディレクトリ読み込みエラー:', e);
      res.statusCode = 404;
      res.end();
      return;
    }

    // 拡張子を除いた basename が一致するファイルを探す。無ければフォールバック。
    const match =
      entries.find((f) => path.basename(f, path.extname(f)) === name) ??
      (entries.includes(NOT_FOUND_FILE) ? NOT_FOUND_FILE : undefined);
    if (!match) {
      res.statusCode = 404;
      res.end();
      return;
    }

    const resolved = path.resolve(dir, match);
    if (!resolved.startsWith(dir + path.sep)) {
      res.statusCode = 400;
      res.end();
      return;
    }

    // resizeWidth 指定時: sharp で高品質縮小した PNG を（キャッシュ経由で）返す。
    if (resizeWidth) {
      try {
        const stat = fs.statSync(resolved);
        const cacheKey = `${resolved}:${stat.mtimeMs}:${resizeWidth}`;
        let buf = resizeCache.get(cacheKey);
        if (!buf) {
          buf = await sharp(resolved)
            .resize({ width: resizeWidth, withoutEnlargement: true })
            .png()
            .toBuffer();
          resizeCache.set(cacheKey, buf);
        }
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=60');
        res.end(buf);
      } catch (e) {
        log.warn('[serveStageIcons] リサイズ失敗:', e);
        res.statusCode = 500;
        res.end();
      }
      return;
    }

    const contentType = CONTENT_TYPES[path.extname(match).toLowerCase()] ?? 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=60');
    const stream = fs.createReadStream(resolved);
    stream.on('error', (e) => {
      log.warn('[serveStageIcons] ファイル読み込みエラー:', e);
      res.statusCode = 500;
      res.end();
    });
    stream.pipe(res);
  };
}
