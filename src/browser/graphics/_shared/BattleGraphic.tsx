import './battle.css';
import { FitText } from '@/browser/components/FitText';
import { useReplicant } from '@/browser/hooks/useReplicant';
import { useTeamData } from './useTeamData';
import type { Side } from '@/nodecg/messages';
import type { EventId } from '@/schemas';

/** 1 サイドぶん（選手名 4 人 + チーム名 + 勝利本数）。未選択なら何も描かない。 */
function TeamSide({ eventId, side }: { eventId: EventId; side: Side }) {
  const { team } = useTeamData(eventId, side);
  const [winCount] = useReplicant('winCount');
  if (!team) return null;

  const align = side === 'alpha' ? 'left' : 'right';

  return (
    <div className={`battle-side battle-${side}`}>
      {team.rosters[eventId].map((name, i) => (
        <div key={i} className={`battle-player battle-player-${i + 1}`}>
          <FitText html={name} align={align} className="battle-player-name" />
        </div>
      ))}
      <div className="battle-team-name-box">
        <FitText html={team.viewname} align="center" className="battle-team-name" />
      </div>
      <div className="battle-win-count">{winCount?.[side] ?? 0}</div>
    </div>
  );
}

/**
 * 対戦表示（1920×1080、透過背景）。currentEvent の種目の対戦カードを表示する。
 * 枠・ロゴのレイアウト画像は OBS の下レイヤーに敷き、ここでは文字だけを重ねる。
 */
export function BattleGraphic() {
  const [eventId] = useReplicant('currentEvent');
  if (!eventId) return null;

  return (
    <div className="battle-container">
      <TeamSide eventId={eventId} side="alpha" />
      <TeamSide eventId={eventId} side="bravo" />
    </div>
  );
}
