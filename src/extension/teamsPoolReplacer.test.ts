import { describe, expect, test } from 'vitest';
import { createTeamsPoolReplacer } from './teamsPoolReplacer';
import type { Selection, Team, TeamsPool } from '../schemas';

const EMPTY_ROSTERS: Team['rosters'] = {
  areaLimited: ['', '', '', ''],
  areaUnlimited: ['', '', '', ''],
  turf: ['', '', '', ''],
};
const team = (id: string, name: string): Team => ({ id, name, viewname: name, rosters: EMPTY_ROSTERS });

const setup = () => {
  const state: { pool: TeamsPool; selection: Selection } = {
    pool: [team('1', 'りくおくんチーム'), team('2', 'ぽあるんチーム')],
    selection: {
      areaLimited: { alpha: '1', bravo: '2' },
      areaUnlimited: { alpha: null, bravo: null },
      turf: { alpha: null, bravo: null },
    },
  };
  const replace = createTeamsPoolReplacer({
    getPool: () => state.pool,
    setPool: (p) => { state.pool = p; },
    getSelection: () => state.selection,
    setSelection: (s) => { state.selection = s; },
  });
  return { state, replace };
};

describe('createTeamsPoolReplacer', () => {
  test('refuses an empty pool and keeps pool and selection', () => {
    const { state, replace } = setup();
    const before = structuredClone(state);
    expect(replace([])).toBe(false);
    expect(state).toEqual(before);
  });

  test('replaces pool and remaps selection by name', () => {
    const { state, replace } = setup();
    expect(replace([team('1', 'ぽあるんチーム'), team('2', 'りくおくんチーム')])).toBe(true);
    expect(state.pool.map((t) => t.name)).toEqual(['ぽあるんチーム', 'りくおくんチーム']);
    expect(state.selection.areaLimited).toEqual({ alpha: '2', bravo: '1' });
  });
});
