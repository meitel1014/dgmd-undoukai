import { useReplicant } from '../../hooks/useReplicant';
import { EVENT_DISPLAY_NAMES, EVENT_IDS } from '@/schemas';

export function EventSelectPanel() {
  const [currentEvent, setCurrentEvent] = useReplicant('currentEvent');

  return (
    <div className="event-select-panel">
      <p>進行中の種目を選択します。チーム選択・プレビュー編集・配信画面が切り替わります。</p>
      <div className="event-select-buttons">
        {EVENT_IDS.map((eventId) => (
          <button
            key={eventId}
            className={`toggle-btn${currentEvent === eventId ? ' toggle-btn--on' : ''}`}
            onClick={() => setCurrentEvent(eventId)}
            disabled={!currentEvent}
          >
            {EVENT_DISPLAY_NAMES[eventId]}
          </button>
        ))}
      </div>
    </div>
  );
}
