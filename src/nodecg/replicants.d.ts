import type { TeamsPool, Selection, WinCount, CurrentEvent } from '../schemas';

/**
 * すべてのReplicantの型を定義するマップ
 */
export type ReplicantMap = {
  teamsPool: TeamsPool;
  selection: Selection;
  winCount: WinCount;
  currentEvent: CurrentEvent;
};
