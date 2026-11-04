import { describe, expect, test, vi } from 'vitest';
import { parseTeamsGrid } from './parseTeamsGrid';

const SHEET = [
  ['', '', '', '', '', ''],
  ['', 'チーム', 'りくおくん', 'ぽあるん', 'チョコパン', 'タクティス'],
  ['', 'エリア制限', 'a1', 'b1', 'c1', 'd1'],
  ['', '', 'a2', 'b2', 'c2', 'd2'],
  ['', '', 'a3', 'b3', 'c3', 'd3'],
  ['', '', 'a4', 'b4', 'c4', 'd4'],
  ['', 'エリア無制限', 'e1', 'f1', 'g1', 'h1'],
  ['', '', 'e2', 'f2', 'g2', 'h2'],
  ['', '', 'e3', 'f3', 'g3', 'h3'],
  ['', '', 'e4', 'f4', 'g4', 'h4'],
  ['', 'ナワバリ', 'ぽ1', 'ぽあるん', 'チョコパン', 'タクティス'],
  ['', '', 'n2', 'o2', 'p2', 'q2'],
  ['', '', 'n3', 'o3', 'p3', 'q3'],
  ['', '', 'n4', 'o4', 'p4', 'q4'],
];

describe('parseTeamsGrid', () => {
  test('parses 4 teams with ids and names', () => {
    const t = parseTeamsGrid(SHEET);
    expect(t.map((x) => [x.id, x.name, x.viewname])).toEqual([
      ['1', 'りくおくんチーム', 'りくおくんチーム'],
      ['2', 'ぽあるんチーム', 'ぽあるんチーム'],
      ['3', 'チョコパンチーム', 'チョコパンチーム'],
      ['4', 'タクティスチーム', 'タクティスチーム'],
    ]);
  });

  test('rosters per event', () => {
    const t = parseTeamsGrid(SHEET);
    expect(t[0].rosters.areaLimited).toEqual(['a1', 'a2', 'a3', 'a4']);
    expect(t[3].rosters.areaUnlimited).toEqual(['h1', 'h2', 'h3', 'h4']);
    expect(t[1].rosters.turf).toEqual(['ぽあるん', 'o2', 'o3', 'o4']);
  });

  test('short rows', () => {
    const sheet = SHEET.map((r) => [...r]);
    sheet[13] = ['', '', 'n4'];
    const t = parseTeamsGrid(sheet);
    expect(t[0].rosters.turf[3]).toBe('n4');
    expect(t[3].rosters.turf[3]).toBe('');
  });

  test('missing label', () => {
    const warn = vi.fn();
    const t = parseTeamsGrid(SHEET.slice(0, 10), warn);
    expect(t[0].rosters.turf).toEqual(['', '', '', '']);
    expect(t[0].rosters.areaLimited).toEqual(['a1', 'a2', 'a3', 'a4']);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  test('truncated block', () => {
    const t = parseTeamsGrid(SHEET.slice(0, 13));
    expect(t[0].rosters.turf).toEqual(['ぽ1', 'n2', 'n3', '']);
  });

  test('no team row', () => {
    const warn = vi.fn();
    expect(parseTeamsGrid(SHEET.slice(2), warn)).toEqual([]);
    expect(warn).toHaveBeenCalled();
  });

  test('trims cells', () => {
    const sheet = SHEET.map((r) => [...r]);
    sheet[1] = ['', ' チーム ', ' りくおくん ', 'ぽあるん', 'チョコパン', 'タクティス'];
    sheet[2] = ['', ' エリア制限 ', ' a1 ', 'b1', 'c1', 'd1'];
    const t = parseTeamsGrid(sheet);
    expect(t[0].name).toBe('りくおくんチーム');
    expect(t[0].rosters.areaLimited[0]).toBe('a1');
  });

  test('skips blank captain columns', () => {
    const sheet = SHEET.map((r) => [...r]);
    sheet[1] = ['', 'チーム', 'りくおくん', '', 'チョコパン'];
    const t = parseTeamsGrid(sheet);
    expect(t.map((x) => x.name)).toEqual(['りくおくんチーム', 'チョコパンチーム']);
    expect(t[1].id).toBe('2');
    expect(t[1].rosters.areaLimited[0]).toBe('c1');
  });
});
