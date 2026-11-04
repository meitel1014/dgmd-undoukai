import { describe, expect, test } from 'vitest';
import { applyResult, changedSides, remapSelection, selectionNames } from './matchState';
import type { Selection, Team, TeamsPool } from '../schemas';

const EMPTY_ROSTERS: Team['rosters'] = {
  areaLimited: ['', '', '', ''],
  areaUnlimited: ['', '', '', ''],
  turf: ['', '', '', ''],
};
const team = (id: string, name: string): Team => ({ id, name, viewname: name, rosters: EMPTY_ROSTERS });

const sel = (overrides: Partial<Selection> = {}): Selection => ({
  areaLimited: { alpha: null, bravo: null },
  areaUnlimited: { alpha: null, bravo: null },
  turf: { alpha: null, bravo: null },
  ...overrides,
});

const OLD_POOL: TeamsPool = [team('1', 'りくおくんチーム'), team('2', 'ぽあるんチーム'), team('3', 'チョコパンチーム')];
const NEW_POOL: TeamsPool = [team('1', 'ぽあるんチーム'), team('2', 'りくおくんチーム')];

describe('applyResult', () => {
  test('applyResult caps at 2', () => {
    expect(applyResult({ alpha: 2, bravo: 0 }, 'alpha_win')).toEqual({ alpha: 2, bravo: 0 });
    expect(applyResult({ alpha: 1, bravo: 0 }, 'bravo_win')).toEqual({ alpha: 1, bravo: 1 });
    expect(applyResult({ alpha: 2, bravo: 1 }, 'reset')).toEqual({ alpha: 0, bravo: 0 });
  });
});

describe('changedSides', () => {
  test('changedSides', () => {
    const base = selectionNames(sel({ areaLimited: { alpha: '1', bravo: '2' }, turf: { alpha: '1', bravo: '2' } }), OLD_POOL);
    const alphaOnly = selectionNames(sel({ areaLimited: { alpha: '3', bravo: '2' }, turf: { alpha: '1', bravo: '2' } }), OLD_POOL);
    const both = selectionNames(sel({ areaLimited: { alpha: '3', bravo: '2' }, turf: { alpha: '1', bravo: '3' } }), OLD_POOL);
    expect(changedSides(base, alphaOnly)).toEqual(['alpha']);
    expect(changedSides(base, both)).toEqual(['alpha', 'bravo']);
    expect(changedSides(base, base)).toEqual([]);
  });

  test('changedSides ignores id-only change', () => {
    const oldSel = sel({ areaLimited: { alpha: '1', bravo: '2' } });
    const newSel = remapSelection(oldSel, OLD_POOL, NEW_POOL);
    expect(changedSides(selectionNames(oldSel, OLD_POOL), selectionNames(newSel, NEW_POOL))).toEqual([]);
  });
});

describe('remapSelection', () => {
  test('remapSelection', () => {
    const oldSel = sel({ areaLimited: { alpha: '1', bravo: '2' }, turf: { alpha: '3', bravo: null } });
    const next = remapSelection(oldSel, OLD_POOL, NEW_POOL);
    expect(next.areaLimited).toEqual({ alpha: '2', bravo: '1' });
    expect(next.turf).toEqual({ alpha: null, bravo: null });
    expect(next.areaUnlimited).toEqual({ alpha: null, bravo: null });
  });
});
