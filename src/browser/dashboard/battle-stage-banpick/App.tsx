import { useEffect, useRef, useState } from 'react';
import { useReplicant } from '../../hooks/useReplicant';
import { stripHtml } from '@/browser/utils/stripHtml';
import { Html } from '@/browser/components/Html';
import type { StageBanpick, MatchStage } from '@/schemas';

const DEFAULT_BP: StageBanpick = { history: [], banned: [], picked: null, phase: 'pick' };
const DEFAULT_MS: MatchStage = { stage: 'preliminary', round: 1 };
const MAX_BAN = 2;

// パネル用の小さめステージアイコン（data/stages/icon）を配信する /stage-thumbs のURL。
// nodecg.mount() はバンドル名プレフィックスされないため素のパスを返す。
function stageThumbUrl(name: string): string {
  return `/stage-thumbs/${encodeURIComponent(stripHtml(name))}`;
}

// ステージアイコン + 左下に小さめの名前 + 下部の黒グラデーションを描くタイル。
// label は <br> 等の改行指定を含みうるため Html 経由で描画する（省略時は name）。
function StageTile({ name, label }: { name: string; label?: string }) {
  return (
    <>
      <img
        className="stage-btn__icon"
        src={stageThumbUrl(name)}
        alt={name}
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
        }}
      />
      <span className="stage-btn__grad" />
      <Html as="span" className="stage-btn__name" value={label ?? name} />
    </>
  );
}

// 次のマッチへ進む際の matchStage 前進ロジック。
// 予選が規定回戦に達したら準決勝、準決勝なら決勝、決勝は据え置き。
function advanceMatchStage(ms: MatchStage, regulationRounds: number): MatchStage {
  if (ms.stage === 'preliminary') {
    return ms.round < regulationRounds
      ? { stage: 'preliminary', round: ms.round + 1 }
      : { stage: 'semifinal', round: 1 };
  }
  if (ms.stage === 'semifinal') return { stage: 'final', round: 1 };
  return ms; // final は据え置き
}

export function StageBanpickPanel() {
  const [stagePool] = useReplicant('stagePool');
  const [stageBanpick, setStageBanpick] = useReplicant('stageBanpick');
  const [detectedStage, setDetectedStage] = useReplicant('detectedStage');
  const [matchStage, setMatchStage] = useReplicant('matchStage');
  const [regulationRounds] = useReplicant('regulationRounds');
  const [winTarget] = useReplicant('winTarget');
  const [winCount] = useReplicant('winCount');
  const [, setSelection] = useReplicant('selection');

  const pool = stagePool ?? { starter: [], counter: [], labels: {} };
  const bp = stageBanpick ?? DEFAULT_BP;

  // ステージ名 → 表示ラベル（<br> 等を含みうる）。未登録は名前そのまま。
  const labelOf = (name: string) => pool.labels[name] ?? name;

  const currentGame = bp.history.length + 1;
  const isGame1 = bp.history.length === 0;

  // BO の最大試合数（先取本数 winTarget から算出）。BO1→1 / BO3→3 / BO5→5。
  // この試合数より先（次の試合）へは進めない。
  const maxGames = (winTarget ?? 2) * 2 - 1;
  const isLastGame = currentGame >= maxGames;

  // 選択グリッドに並べるステージ。1試合目はスターターのみ（カウンターは選ばれないため非表示）、
  // 2試合目以降はスターター＋カウンターの全プール（重複除去）。使用済みは各ボタン側で無効化する。
  const fullPool = isGame1 ? pool.starter : [...new Set([...pool.starter, ...pool.counter])];
  const usedSet = new Set(bp.history);

  // ── 操作ハンドラ ──────────────────────────────

  const toggleBan = (name: string) => {
    if (usedSet.has(name)) return;
    const banned = bp.banned.includes(name)
      ? bp.banned.filter((s) => s !== name)
      : bp.banned.length < MAX_BAN
        ? [...bp.banned, name]
        : bp.banned;
    setStageBanpick({ ...bp, banned });
  };

  const selectPick = (name: string) => {
    if (usedSet.has(name) || bp.banned.includes(name)) return;
    // 選択済みのステージを再クリックしたら選択解除する。
    setStageBanpick({ ...bp, picked: bp.picked === name ? null : name });
  };

  const confirmBan = () => setStageBanpick({ ...bp, phase: 'pick' });

  const confirmPick = () => {
    if (!bp.picked) return;
    // 1試合目はおまかせで確定段階が不要なため、確定と同時に次の試合の BAN へ直行する。
    // （BO1 など次の試合が無い場合は従来どおり確定表示にする）
    if (isGame1 && !isLastGame) {
      setStageBanpick({ history: [...bp.history, bp.picked], banned: [], picked: null, phase: 'ban' });
    } else {
      setStageBanpick({ ...bp, phase: 'confirmed' });
    }
  };

  // 次の試合へ: 確定したステージを history に積み、BAN フェーズで次試合を開始。
  // BO の最大試合数（winTarget）に達している場合は進めない。
  const nextGame = () => {
    if (!bp.picked || isLastGame) return;
    setStageBanpick({
      history: [...bp.history, bp.picked],
      banned: [],
      picked: null,
      phase: 'ban',
    });
  };

  // 第1試合の確定前に /stage による新しいステージ判別が来たら、選択を自動で上書きする。
  // 判別結果（stageName + score）が変化したときだけ適用し、パネル再表示時の永続値の
  // 再適用は避ける（初回はシグネチャを記録するだけ）。
  const detStageName = detectedStage?.stageName ?? null;
  const detScore = detectedStage?.score ?? 0;
  const lastDetectionRef = useRef<string | null>(null);
  const mountedRef = useRef(false);

  // 判別が来たことを示す点滅（確定ボタンまでの領域）。
  const [flashing, setFlashing] = useState(false);
  const flashTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const sig = detStageName ? `${detStageName}:${detScore}` : null;
    if (!mountedRef.current) {
      mountedRef.current = true;
      lastDetectionRef.current = sig; // 初回（永続値）は記録のみ・適用しない
      return;
    }
    if (sig === lastDetectionRef.current) return;
    lastDetectionRef.current = sig;
    // 第1試合かつ確定前（pick フェーズ）のときだけ、判別ステージで上書きし点滅で通知。
    if (detStageName && isGame1 && bp.phase === 'pick') {
      setStageBanpick({ ...bp, picked: detStageName });
      // いったん解除→次フレームで付与し、連続判別でもアニメーションを再スタートさせる。
      if (flashTimerRef.current !== null) window.clearTimeout(flashTimerRef.current);
      setFlashing(false);
      window.requestAnimationFrame(() => setFlashing(true));
      flashTimerRef.current = window.setTimeout(() => {
        setFlashing(false);
        flashTimerRef.current = null;
      }, 4000);
    }
  }, [detStageName, detScore, isGame1, bp, setStageBanpick]);

  // /result で勝敗が入って winCount 合計が増えたら、現在のステージが確定済みの状態
  // （第1試合=選択済みの pick / 第2試合以降=confirmed）に限り、自動で次の試合の BAN へ進む。
  const winTotal = (winCount?.alpha ?? 0) + (winCount?.bravo ?? 0);
  const prevWinTotalRef = useRef<number | null>(null);
  const mountedWinRef = useRef(false);
  useEffect(() => {
    if (!mountedWinRef.current) {
      mountedWinRef.current = true;
      prevWinTotalRef.current = winTotal; // 初回（永続値）は記録のみ
      return;
    }
    const prev = prevWinTotalRef.current ?? 0;
    prevWinTotalRef.current = winTotal;
    if (winTotal <= prev) return; // 勝敗が入った（合計増加）ときのみ。reset 等は無視
    // マッチが決着（どちらかが必要勝利数に到達）した場合は次の試合が無いので進めない。
    const target = winTarget ?? 2;
    const decided = (winCount?.alpha ?? 0) >= target || (winCount?.bravo ?? 0) >= target;
    if (decided || isLastGame) return;

    const stageDecided =
      !!bp.picked && ((isGame1 && bp.phase === 'pick') || (!isGame1 && bp.phase === 'confirmed'));
    if (stageDecided) {
      setStageBanpick({ history: [...bp.history, bp.picked!], banned: [], picked: null, phase: 'ban' });
    }
  }, [winTotal, winCount, winTarget, isGame1, isLastGame, bp, setStageBanpick]);

  // 一つ前の段階へ戻る。
  const canGoBack =
    bp.phase === 'confirmed' ||
    (bp.phase === 'pick' && !isGame1) ||
    (bp.phase === 'ban' && bp.history.length > 0);

  const goBack = () => {
    if (bp.phase === 'confirmed') {
      setStageBanpick({ ...bp, phase: 'pick' });
    } else if (bp.phase === 'pick' && !isGame1) {
      setStageBanpick({ ...bp, phase: 'ban', picked: null });
    } else if (bp.phase === 'ban' && bp.history.length > 0) {
      // 直前の試合へ巻き戻す。1試合目には確定段階が無いので pick に戻し、
      // それ以外は確定表示（confirmed）に戻す。
      const prev = bp.history[bp.history.length - 1];
      const newHistory = bp.history.slice(0, -1);
      setStageBanpick({
        history: newHistory,
        banned: [],
        picked: prev,
        phase: newHistory.length === 0 ? 'pick' : 'confirmed',
      });
    }
  };

  // 前マッチの自動判別結果が残らないよう、リセット時は detectedStage も破棄する。
  const reset = () => {
    setStageBanpick(DEFAULT_BP);
    setDetectedStage({ stageName: null, score: 0 });
  };

  const resetAndNextMatch = () => {
    setStageBanpick(DEFAULT_BP);
    setDetectedStage({ stageName: null, score: 0 });
    setSelection({ alpha: null, bravo: null });
    setMatchStage(advanceMatchStage(matchStage ?? DEFAULT_MS, regulationRounds ?? 3));
  };

  // ── ステージボタンの状態算出 ──────────────────

  const stageButtonClass = (name: string): string => {
    const classes = ['stage-btn'];
    if (usedSet.has(name)) classes.push('stage-btn--used');
    if (bp.banned.includes(name)) classes.push('stage-btn--ban');
    if (bp.picked === name) classes.push('stage-btn--pick');
    return classes.join(' ');
  };

  const onStageClick = (name: string) => {
    if (bp.phase === 'ban') toggleBan(name);
    else if (bp.phase === 'pick') selectPick(name);
  };

  const phaseLabel =
    bp.phase === 'ban'
      ? `BAN（${bp.banned.length}/${MAX_BAN}）`
      : bp.phase === 'pick'
        ? 'PICK（1つ選択）'
        : '確定';

  return (
    <div className="banpick-panel">
      {/* ステージ選択〜確定ボタンの領域。自動判別が来たら点滅して通知する。 */}
      <div className={`banpick-select-region${flashing ? ' banpick-flash' : ''}`}>
      <div className="banpick-head">
        <span className="banpick-game">第{currentGame}試合 / 最大{maxGames}試合</span>
        <span className={`banpick-phase banpick-phase--${bp.phase}`}>
          {isGame1 ? 'スターターからおまかせ' : phaseLabel}
        </span>
      </div>

      {/* 1試合目の自動判別結果（判別され次第、選択へ自動反映される） */}
      {isGame1 && bp.phase !== 'confirmed' && (
        <div className="banpick-detect">
          <span>
            自動判別:{' '}
            {detectedStage?.stageName
              ? `${detectedStage.stageName}（${(detectedStage.score * 100).toFixed(1)}%）`
              : '未判別'}
          </span>
        </div>
      )}

      {/* ステージ選択グリッド（confirmed 時は非表示） */}
      {bp.phase !== 'confirmed' && (
        <div className="banpick-grid">
          {fullPool.map((name) => (
            <button
              key={name}
              className={stageButtonClass(name)}
              disabled={usedSet.has(name) || (bp.phase === 'pick' && bp.banned.includes(name))}
              onClick={() => onStageClick(name)}
            >
              <StageTile name={name} label={labelOf(name)} />
            </button>
          ))}
        </div>
      )}

      {/* 確定表示（テキスト表記 + 左にアイコン） */}
      {bp.phase === 'confirmed' && (
        <div className="banpick-confirmed">
          <span className="banpick-confirmed-label">選択ステージ</span>
          <div className="banpick-confirmed-body">
            {bp.picked && (
              <img
                className="banpick-confirmed-icon"
                src={stageThumbUrl(bp.picked)}
                alt={bp.picked}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            )}
            <span className="banpick-confirmed-stage">{bp.picked ?? '—'}</span>
          </div>
        </div>
      )}

      {/* フェーズ別の確定/進行ボタン */}
      <div className="banpick-actions">
        {bp.phase === 'ban' && (
          <button className="btn" disabled={bp.banned.length !== MAX_BAN} onClick={confirmBan}>
            確定（BAN {bp.banned.length}/{MAX_BAN}）→ PICK へ
          </button>
        )}
        {bp.phase === 'pick' && (
          <button className="btn" disabled={!bp.picked} onClick={confirmPick}>
            {isGame1 ? (isLastGame ? '確定' : '確定して次の試合へ') : '確定（PICK）'}
          </button>
        )}
        {bp.phase === 'confirmed' && (
          <button className="btn" disabled={isLastGame} onClick={nextGame}>
            {isLastGame ? `最終試合（BO${maxGames}）` : '次の試合へ'}
          </button>
        )}
      </div>
      </div>

      {/* 戻る / リセット系 */}
      <div className="banpick-footer">
        <button className="btn-sm" disabled={!canGoBack} onClick={goBack}>
          戻る
        </button>
        <button className="btn-sm" onClick={reset}>
          リセット
        </button>
        <button className="btn-sm btn-next-match" onClick={resetAndNextMatch}>
          リセットして次のマッチへ
        </button>
      </div>

      {/* このマッチのバンピック履歴（確定済みの各試合ステージ） */}
      <div className="banpick-history">
        <span className="banpick-history-label">このマッチの履歴</span>
        {bp.history.length === 0 ? (
          <span className="banpick-history-empty">まだ確定した試合はありません</span>
        ) : (
          <div className="banpick-history-list">
            {bp.history.map((name, i) => (
              <div key={i} className="history-item">
                <div className="stage-btn history-item__tile">
                  <StageTile name={name} label={labelOf(name)} />
                </div>
                <span className="history-item__label">第{i + 1}試合</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
