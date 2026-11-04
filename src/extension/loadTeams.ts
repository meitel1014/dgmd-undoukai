import fs from 'node:fs';
import path from 'node:path';
import { parseCsv } from './csv';
import { parseTeamsGrid } from './parseTeamsGrid';
import type { TeamsPool } from '../schemas';

const CSV_PATH = path.resolve(process.cwd(), 'data/teams.csv');

/**
 * CSV テキストを直接受け取って TeamsPool を構築する。
 * CSV は出場者スプレッドシートを CSV エクスポートしたものと同じ表形式。ファイルには書き込まない。
 */
export function parseTeamsPoolFromCsvText(raw: string): TeamsPool {
  return parseTeamsGrid(parseCsv(raw), (msg) => console.warn(msg));
}

/** data/teams.csv を読んで TeamsPool を構築する。ファイルが存在しない場合は空を返す。 */
export function loadTeamsPoolFromCsv(): TeamsPool {
  if (!fs.existsSync(CSV_PATH)) {
    return [];
  }
  try {
    return parseTeamsPoolFromCsvText(fs.readFileSync(CSV_PATH, 'utf-8'));
  } catch (e) {
    console.error(`[loadTeams] Failed to read ${CSV_PATH}:`, e);
    return [];
  }
}
