import { z } from 'zod';

export const strategySchema = z.object({
  question: z.string().trim().min(1).max(500),
  player: z.object({ name: z.string().max(100), position: z.number().int().min(0).max(100), money: z.number().min(-1e9).max(1e9), shares: z.number().int().min(0).max(1e6), skipNext: z.boolean() }),
  tile: z.string().max(250),
  price: z.number().int().min(0).max(999),
  previousPrice: z.number().int().min(0).max(999).nullable(),
  currency: z.enum(['USD', 'EUR', 'GBP', 'JPY']),
  phase: z.string().max(30),
  forecast: z.enum(['bull', 'bear', 'neutral']),
  isTurn: z.boolean(),
  hold: z.boolean(),
  diceSides: z.number().int().min(1).max(18),
});
export type StrategyInput = z.infer<typeof strategySchema>;

export function strategyFacts(data: StrategyInput) {
  return { ...data, netWorth: data.player.money + data.player.shares * data.price,
    canTrade: data.isTurn && data.phase === 'trade' && !data.hold,
    affordableShares: data.price > 0 ? Math.max(0, Math.floor(data.player.money / data.price)) : null };
}