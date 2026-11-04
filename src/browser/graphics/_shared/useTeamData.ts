import { useReplicant } from '../../hooks/useReplicant';
import type { Side } from '@/nodecg/messages';
import type { EventId, Team } from '@/schemas';

/** 指定種目・指定サイドで選択されているチームデータを返す。 */
export function useTeamData(eventId: EventId, side: Side): { team: Team | null } {
  const [teamsPool] = useReplicant('teamsPool');
  const [selection] = useReplicant('selection');

  const teamId = selection?.[eventId][side] ?? null;
  const team = teamId
    ? teamsPool?.find((t) => t.id === teamId) ?? null
    : null;

  return { team };
}
