import type { NodeCG } from './nodecg';
import { loadTeamsPoolFromCsv, parseTeamsPoolFromCsvText } from './loadTeams';
import { loadTeamsFromSheets } from './loadTeamsFromSheets';
import { applyResult, changedSides, selectionNames } from './matchState';
import { createTeamsPoolReplacer } from './teamsPoolReplacer';
import type { Team } from '../schemas';

export default (nodecg: NodeCG) => {
  const log = new nodecg.Logger('ikaterrace');
  log.info('=====Extension is running=====');

  const teamsPoolRep = nodecg.Replicant('teamsPool');
  const selectionRep = nodecg.Replicant('selection');
  const winCountRep = nodecg.Replicant('winCount');

  // チーム選択が入れ替わったら、その枠の勝利数（全種目共有）を 0 にリセットする。
  // Extension 側で一元化することで、Dashboard 経由でもプログラム経由でも確実にリセットされる。
  // 比較は ID ではなくチーム名で行う（再読込で ID だけが付け替わった場合はリセットしない）。
  let prevNames: ReturnType<typeof selectionNames> | null = null;
  selectionRep.on('change', (newVal) => {
    if (!newVal) return;
    const nextNames = selectionNames(newVal, teamsPoolRep.value ?? []);
    const sides = prevNames ? changedSides(prevNames, nextNames) : []; // 初回購読は記録のみ
    prevNames = nextNames;
    if (sides.length === 0) return;
    const next = { ...(winCountRep.value ?? { alpha: 0, bravo: 0 }) };
    for (const side of sides) next[side] = 0;
    winCountRep.value = next;
    log.info(`[winCount] selection 変更により勝利数をリセット: ${JSON.stringify(next)}`);
  });

  // teamsPool を丸ごと置き換え、各種目の選択をチーム名で新しい ID に付け替える。
  // チームが 0 件なら置き換えずに false を返す。
  const replaceTeamsPool = createTeamsPoolReplacer({
    getPool: () => teamsPoolRep.value,
    setPool: (pool) => { teamsPoolRep.value = pool; },
    getSelection: () => selectionRep.value,
    setSelection: (sel) => { selectionRep.value = sel; },
  });

  // 初回起動時のみ teamsPool を初期化。Googleスプレッドシートを優先し、
  // 読み込めない場合（未設定・認証失敗等）は data/teams.csv にフォールバックする。
  if ((teamsPoolRep.value ?? []).length === 0) {
    void (async () => {
      const fromSheets = await loadTeamsFromSheets(log);
      if (fromSheets && fromSheets.length > 0) {
        replaceTeamsPool(fromSheets);
        log.info(`Loaded teams from Google Sheets: ${fromSheets.length}`);
      } else {
        const loaded = loadTeamsPoolFromCsv();
        replaceTeamsPool(loaded);
        log.info(`Loaded teams from CSV (fallback): ${loaded.length}`);
      }
    })();
  }

  // POST /upload-teams-csv  (body: UTF-8 CSV text, Content-Type: text/plain)
  const MAX_CSV_BYTES = 1 * 1024 * 1024; // 1 MB: チーム情報CSVとして十分な上限

  nodecg.mount('/upload-teams-csv', (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).end();
      return;
    }

    let totalBytes = 0;
    let oversized = false
    ;
    const chunks: Buffer[] = [];

    req.on('data', (chunk: Buffer) => {
      totalBytes += chunk.length;
      if (totalBytes > MAX_CSV_BYTES) {
        if (!oversized) {
          oversized = true;
          res.status(413).json({ error: 'payload too large' });
          req.destroy();
        }
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      if (oversized) return;

      const csvText = Buffer.concat(chunks).toString('utf-8');
      if (!csvText.trim()) {
        res.status(400).json({ error: 'empty body' });
        return;
      }

      let loaded;
      try {
        loaded = parseTeamsPoolFromCsvText(csvText);
      } catch (e) {
        log.error('[upload-teams-csv] CSV パース失敗', e);
        res.status(400).json({ error: 'invalid CSV' });
        return;
      }

      if (!replaceTeamsPool(loaded)) {
        log.warn('[upload-teams-csv] チームが 0 件のため teamsPool は変更しません');
        res.status(400).json({ error: 'no teams in CSV' });
        return;
      }
      log.info(`[upload-teams-csv] ${loaded.length} 件`);
      res.status(200).json({ teams: loaded.length });
    });

    req.on('error', (e) => {
      log.error('[upload-teams-csv] リクエストエラー', e);
    });
  });

  // OBS 等の外部トリガーから勝利数（本数）を操作するエンドポイント
  // POST /result  (body: { "result": "alpha_win" | "bravo_win" | "reset" }, Content-Type: application/json)
  //   alpha_win / bravo_win → 該当枠 +1（必要勝利数 2 で頭打ち）、reset → 両枠 0
  // NodeCG がグローバルに express.json() を適用済みのため、パース済みの req.body を参照する
  // （不正な JSON はここに到達する前に 400 系で弾かれる）。
  nodecg.mount('/result', (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).end();
      return;
    }

    const result = (req.body as { result?: unknown } | undefined)?.result;
    if (result !== 'alpha_win' && result !== 'bravo_win' && result !== 'reset') {
      log.error('[result] 試合結果受信エラー: ' + String(result));
      res.status(400).json({ error: 'invalid result' });
      return;
    }

    winCountRep.value = applyResult(winCountRep.value ?? { alpha: 0, bravo: 0 }, result);
    log.info(`[result] '${result}' -> winCount=${JSON.stringify(winCountRep.value)}`);
    res.status(202).end();
  });

  // ── Message ハンドラ ───────────────────────────────────

  nodecg.listenFor('reloadTeamsCsv', (_data, ack) => {
    const loaded = loadTeamsPoolFromCsv();
    if (!replaceTeamsPool(loaded)) {
      log.warn('reloadTeamsCsv: data/teams.csv からチームを読めませんでした（teamsPoolは変更なし）');
      if (ack && !ack.handled) ack('data/teams.csv からチームを読めませんでした');
      return;
    }
    log.info(`Reloaded teams from CSV: ${loaded.length}`);
    if (ack && !ack.handled) ack(null);
  });

  nodecg.listenFor('reloadTeamsFromSheets', (_data, ack) => {
    void (async () => {
      const loaded = await loadTeamsFromSheets(log);
      if (loaded) {
        replaceTeamsPool(loaded);
        log.info(`Reloaded teams from Google Sheets: ${loaded.length}`);
        if (ack && !ack.handled) ack(null);
      } else {
        log.warn('reloadTeamsFromSheets: スプレッドシート読み込みに失敗（teamsPoolは変更なし）');
        if (ack && !ack.handled) ack('スプレッドシート読み込みに失敗しました');
      }
    })();
  });

  nodecg.listenFor('updateTeam', ({ teamId, patch }, ack) => {
    const pool = teamsPoolRep.value;
    if (!pool) {
      if (ack && !ack.handled) ack(null);
      return;
    }
    const idx = pool.findIndex((t) => t.id === teamId);
    if (idx < 0) {
      log.warn(`updateTeam: teamId="${teamId}" not found`);
      if (ack && !ack.handled) ack(null);
      return;
    }

    const prev = pool[idx];
    const updated: Team = { ...prev, rosters: { ...prev.rosters } };
    if (patch.viewname !== undefined) updated.viewname = patch.viewname;
    if (patch.player) {
      const { eventId, index, name } = patch.player;
      const roster = [...prev.rosters[eventId]] as Team['rosters'][typeof eventId];
      roster[index] = name;
      updated.rosters[eventId] = roster;
    }

    const newPool = [...pool];
    newPool[idx] = updated;
    teamsPoolRep.value = newPool;
    if (ack && !ack.handled) ack(null);
  });

};
