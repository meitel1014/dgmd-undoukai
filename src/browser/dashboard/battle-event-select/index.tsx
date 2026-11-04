import '@/browser/global.css';
import '../_shared/dashboard.css';
import './event-select.css';
import { createRoot } from 'react-dom/client';
import { EventSelectPanel } from './App';

createRoot(document.getElementById('root')!).render(<EventSelectPanel />);
