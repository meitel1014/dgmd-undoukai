import './TeamSelectPanel.css';
import { useReplicant } from '../../hooks/useReplicant';
import { stripHtml } from '../../utils/stripHtml';
import type { Side } from '@/nodecg/messages';
import type { EventId } from '@/schemas';

export function TeamSelectPanel({ eventId }: { eventId: EventId }) {
  const [teamsPool] = useReplicant('teamsPool');
  const [selection, setSelection] = useReplicant('selection');

  if (!teamsPool || !selection) return <p>読み込み中…</p>;

  const current = selection[eventId];

  const handleChange = (side: Side, teamId: string) => {
    setSelection({
      ...selection,
      [eventId]: { ...current, [side]: teamId || null },
    });
  };

  return (
    <div className="team-select-panel">
      <div className="field field-alpha">
        <label>アルファチーム</label>
        <select
          value={current.alpha ?? ''}
          onChange={(e) => handleChange('alpha', e.target.value)}
        >
          <option value="">-- 選択してください --</option>
          {teamsPool.map((t) => (
            <option key={t.id} value={t.id}>
              {stripHtml(t.name)}
            </option>
          ))}
        </select>
      </div>

      <div className="field field-bravo">
        <label>ブラボーチーム</label>
        <select
          value={current.bravo ?? ''}
          onChange={(e) => handleChange('bravo', e.target.value)}
        >
          <option value="">-- 選択してください --</option>
          {teamsPool.map((t) => (
            <option key={t.id} value={t.id}>
              {stripHtml(t.name)}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
