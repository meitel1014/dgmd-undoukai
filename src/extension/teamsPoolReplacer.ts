import { remapSelection } from './matchState';
import type { Selection, TeamsPool } from '../schemas';

type Deps = {
  getPool: () => TeamsPool | undefined;
  setPool: (pool: TeamsPool) => void;
  getSelection: () => Selection | undefined;
  setSelection: (sel: Selection) => void;
};

/**
 * teamsPool を丸ごと置き換え、各種目の選択をチーム名で新しい ID に付け替える関数を作る。
 * - チームが 0 件のプールは置き換えずに false を返す（誤った CSV で全種目の選択・勝利数が消えるのを防ぐ）
 * - teamsPool を先に置き換えるので、selection の change ハンドラは新しいプールで名前を解決する。
 *   2 つの代入の間に await を挟まないこと（間に描画・ハンドラが入ると名前解決がずれる）
 */
export function createTeamsPoolReplacer({ getPool, setPool, getSelection, setSelection }: Deps) {
  return (next: TeamsPool): boolean => {
    if (next.length === 0) return false;
    const oldPool = getPool() ?? [];
    setPool(next);
    const sel = getSelection();
    if (sel) setSelection(remapSelection(sel, oldPool, next));
    return true;
  };
}
