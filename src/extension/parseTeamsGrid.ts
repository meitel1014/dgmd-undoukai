import { EVENT_IDS, EVENT_SHEET_LABELS } from '../schemas/event';
import type { EventId, Roster } from '../schemas/event';

export type GridTeam = {
  id: string;
  name: string;
  viewname: string;
  rosters: Record<EventId, Roster>;
};

const TEAM_LABEL = 'チーム';
const LABEL_COL = 1; // B 列
const ROSTER_SIZE = 4;

/**
 * 出場者スプレッドシート（列 = チーム、行 = 種目×4人の表形式）を TeamsPool 相当に変換する。
 * - B 列が「チーム」の行の C 列以降に主将名が並ぶ。空セルの列は無視する
 * - B 列が種目ラベルの行から 4 行ぶんが、その種目の出場選手
 * 位置ではなくラベルで探すため、行の追加・並べ替えに強い。欠けたセルは空文字として扱う。
 */
export function parseTeamsGrid(rows: string[][], warn: (msg: string) => void = () => {}): GridTeam[] {
  const cell = (r: number, c: number) => String(rows[r]?.[c] ?? '').trim();
  const findLabelRow = (label: string) => rows.findIndex((_, r) => cell(r, LABEL_COL) === label);

  const teamRow = findLabelRow(TEAM_LABEL);
  if (teamRow < 0) {
    warn(`[parseTeamsGrid] B 列に「${TEAM_LABEL}」行が見つかりません`);
    return [];
  }

  const captains: { col: number; name: string }[] = [];
  for (let c = LABEL_COL + 1; c < (rows[teamRow]?.length ?? 0); c++) {
    const name = cell(teamRow, c);
    if (name) captains.push({ col: c, name });
  }

  const labelRows = {} as Record<EventId, number>;
  for (const eventId of EVENT_IDS) {
    labelRows[eventId] = findLabelRow(EVENT_SHEET_LABELS[eventId]);
    if (labelRows[eventId] < 0) {
      warn(`[parseTeamsGrid] 種目ラベル「${EVENT_SHEET_LABELS[eventId]}」が見つかりません（選手名は空になります）`);
    }
  }

  return captains.map(({ col, name }, i) => {
    const rosters = {} as Record<EventId, Roster>;
    for (const eventId of EVENT_IDS) {
      const start = labelRows[eventId];
      rosters[eventId] = Array.from({ length: ROSTER_SIZE }, (_, k) =>
        start < 0 ? '' : cell(start + k, col),
      ) as Roster;
    }
    const teamName = `${name}チーム`;
    return { id: String(i + 1), name: teamName, viewname: teamName, rosters };
  });
}
