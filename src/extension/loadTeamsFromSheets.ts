import { findCredentialsFile, createGoogleAuth, getSpreadsheet, resolveWorksheet } from './googleSheetsClient';
import { loadSheetsConfig } from './sheetsConfig';
import { parseTeamsGrid } from './parseTeamsGrid';
import type { TeamsPool } from '../schemas';

type Log = {
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
};

/** 読み込むセル範囲。表はヘッダ行を持たないため getRows ではなく生の値で取得する。 */
const CELL_RANGE = 'A1:Z200';

/**
 * 出場者スプレッドシート（列 = チーム、行 = 種目×4人）から TeamsPool を構築する。
 * 認証・読み込みのいずれかに失敗した場合、またはチームが 1 つも読めない場合は null を返す
 * （呼び出し側で CSV にフォールバックする想定）。
 */
export async function loadTeamsFromSheets(log: Log): Promise<TeamsPool | null> {
  try {
    const config = loadSheetsConfig(log);
    if (!config) return null;

    const keyFilePath = findCredentialsFile(log);
    if (!keyFilePath) return null;

    const doc = await getSpreadsheet(config.spreadsheetId, createGoogleAuth(keyFilePath));
    const sheet = resolveWorksheet(doc, config);
    if (!sheet) {
      log.warn('[loadTeamsFromSheets] ワークシートが見つかりません');
      return null;
    }

    const values = ((await sheet.getCellsInRange(CELL_RANGE)) ?? []) as unknown[][];
    const rows = values.map((row) => row.map((v) => String(v ?? '')));
    const pool = parseTeamsGrid(rows, (msg) => log.warn(msg));
    return pool.length > 0 ? pool : null;
  } catch (e) {
    log.error('[loadTeamsFromSheets] スプレッドシート読み込みに失敗しました:', e);
    return null;
  }
}
