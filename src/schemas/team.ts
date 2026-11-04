import { z } from 'zod';

/** 1 種目ぶんの出場選手名 4 人 */
export const rosterSchema = z.tuple([z.string(), z.string(), z.string(), z.string()]);

/**
 * 1 チームの情報。
 * `id`       : 読み込み時に主将の並び順で割り振る連番文字列 ("1", "2", ...)。
 *              Replicant 内の検索キー。変更不可。
 * `name`     : チーム名原本（`{主将名}チーム`）。Dashboard 表示に使う。編集禁止。
 * `viewname` : 表示用チーム名。`<br>` 等の生 HTML を含む場合がある。
 *              Dashboard から自由に編集でき、Graphic でのみ参照する。全種目共通。
 * `rosters`  : 種目ごとの出場選手名 4 人。
 */
export const teamSchema = z.object({
  id: z.string(),
  name: z.string(),
  viewname: z.string(),
  rosters: z.object({
    areaLimited: rosterSchema,
    areaUnlimited: rosterSchema,
    turf: rosterSchema,
  }),
});

export type Team = z.infer<typeof teamSchema>;
