import { z } from 'zod';
import { EVENT_IDS } from './event';

/**
 * 現在進行中の種目。Dashboard の「種目選択」パネルが書き、
 * チーム選択・プレビュー編集パネルと battle Graphic が読む。
 */
export const currentEventSchema = z.enum(EVENT_IDS).default('areaLimited');

export type CurrentEvent = z.infer<typeof currentEventSchema>;
