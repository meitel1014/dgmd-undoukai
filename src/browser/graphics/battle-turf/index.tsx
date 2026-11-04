import '@/browser/global.css';
import { createRoot } from 'react-dom/client';
import { BattleGraphic } from '../_shared/BattleGraphic';

createRoot(document.getElementById('root')!).render(<BattleGraphic eventId="turf" />);
