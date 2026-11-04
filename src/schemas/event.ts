/**
 * デジ窓大運動会のスプラ種目。
 * Replicant ではないため `*Schema` は持たず、定数と型だけを提供する。
 */
export const EVENT_IDS = ['areaLimited', 'areaUnlimited', 'turf'] as const;

export type EventId = (typeof EVENT_IDS)[number];

/** 出場者スプレッドシートの B 列に書かれる種目ラベル */
export const EVENT_SHEET_LABELS: Record<EventId, string> = {
  areaLimited: 'エリア制限',
  areaUnlimited: 'エリア無制限',
  turf: 'ナワバリ',
};

/** Dashboard 等の表示用種目名 */
export const EVENT_DISPLAY_NAMES: Record<EventId, string> = EVENT_SHEET_LABELS;

/** 必要勝利数（全種目 BO3 = 2本先取で固定） */
export const WIN_TARGET = 2;

/** 1 種目ぶんの出場選手名 4 人 */
export type Roster = [string, string, string, string];
