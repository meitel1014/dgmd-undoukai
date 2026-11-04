import { z } from 'zod';

/** 1 種目ぶんのアルファ / ブラボー選択チーム ID（null は未選択） */
export const sideSelectionSchema = z.object({
  alpha: z.string().nullable(),
  bravo: z.string().nullable(),
});

/**
 * 種目ごとの選択チーム ID。ID は TeamsPool 内で一意のキーとして扱う。
 * NodeCG は JSON Schema の default から初期値を作るため、default は全種目ぶんを明示する。
 */
export const selectionSchema = z
  .object({
    areaLimited: sideSelectionSchema,
    areaUnlimited: sideSelectionSchema,
    turf: sideSelectionSchema,
  })
  .default({
    areaLimited: { alpha: null, bravo: null },
    areaUnlimited: { alpha: null, bravo: null },
    turf: { alpha: null, bravo: null },
  });

export type SideSelection = z.infer<typeof sideSelectionSchema>;
export type Selection = z.infer<typeof selectionSchema>;
