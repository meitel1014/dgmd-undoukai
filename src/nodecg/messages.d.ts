import type { EventId } from '../schemas';

export type Side = 'alpha' | 'bravo';

/**
 * すべてのメッセージの型を定義するマップ
 */
export type MessageMap = {
  /** data/teams.csv から teamsPool を再読み込み（編集内容は破棄される） */
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- ts-nodecg の規約：データなしメッセージは {} で表現
  reloadTeamsCsv: {};

  /**
   * Google スプレッドシート（出場者シート）から teamsPool を再読み込み。
   * 読み込みに失敗した場合 teamsPool は変更されない。
   */
  reloadTeamsFromSheets: { error: string };

  /**
   * teamsPool 内の 1 チームを ID キーで部分更新する。
   * `viewname` は全種目共通、`player` は指定種目の 1 人ぶんの選手名を書き換える。
   */
  updateTeam: {
    data: {
      teamId: string;
      patch: {
        viewname?: string;
        player?: { eventId: EventId; index: 0 | 1 | 2 | 3; name: string };
      };
    };
  };
};
