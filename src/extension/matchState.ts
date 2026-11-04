import { EVENT_IDS, WIN_TARGET } from '../schemas/event';
import type { EventId } from '../schemas/event';
import type { Selection, TeamsPool, WinCount } from '../schemas';
import type { Side } from '../nodecg/messages';

export type ResultKind = 'alpha_win' | 'bravo_win' | 'reset';

type SelectionNames = Record<EventId, Record<Side, string | null>>;

const SIDES: Side[] = ['alpha', 'bravo'];

/** 試合結果を勝利数に反映する。加算は WIN_TARGET で頭打ち。 */
export function applyResult(wc: WinCount, result: ResultKind): WinCount {
  if (result === 'reset') return { alpha: 0, bravo: 0 };
  const side: Side = result === 'alpha_win' ? 'alpha' : 'bravo';
  return { ...wc, [side]: Math.min(WIN_TARGET, wc[side] + 1) };
}

/** 各種目の選択チーム ID をチーム名（name）に解決する。見つからない ID は null。 */
export function selectionNames(sel: Selection, pool: TeamsPool): SelectionNames {
  const nameOf = (id: string | null) => (id ? pool.find((t) => t.id === id)?.name ?? null : null);
  const out = {} as SelectionNames;
  for (const eventId of EVENT_IDS) {
    out[eventId] = { alpha: nameOf(sel[eventId].alpha), bravo: nameOf(sel[eventId].bravo) };
  }
  return out;
}

/**
 * いずれかの種目で選択チーム（name）が変わった Side を返す。
 * ID ではなく name で比べるので、再読込で ID だけが付け替わった場合は変化なしとみなす。
 */
export function changedSides(prev: SelectionNames, next: SelectionNames): Side[] {
  return SIDES.filter((side) => EVENT_IDS.some((eventId) => prev[eventId][side] !== next[eventId][side]));
}

/** teamsPool 置き換え時に、各種目の選択を name で新しい ID に付け替える。見つからなければ null。 */
export function remapSelection(sel: Selection, oldPool: TeamsPool, newPool: TeamsPool): Selection {
  const names = selectionNames(sel, oldPool);
  const idOf = (name: string | null) => (name ? newPool.find((t) => t.name === name)?.id ?? null : null);
  const out = {} as Selection;
  for (const eventId of EVENT_IDS) {
    out[eventId] = { alpha: idOf(names[eventId].alpha), bravo: idOf(names[eventId].bravo) };
  }
  return out;
}
