import { describe, expect, it } from 'vitest';
import { strategyFacts, type StrategyInput } from '../lib/ai/strategy-schema';
const input: StrategyInput = { question: 'Should I buy?', player: { name: 'Player', position: 5, money: 5000, shares: 9, skipNext: false }, tile: 'Growth (+5)', price: 500, previousPrice: null, currency: 'USD', phase: 'trade', forecast: 'neutral', isTurn: true, hold: false, diceSides: 6 };
describe('Strategy facts preserve game rules', () => {
  it('calculates total as cash plus shares times price', () => { expect(strategyFacts(input).netWorth).toBe(9500); });
  it('never suggests trading during mandatory hold', () => { expect(strategyFacts({ ...input, hold: true }).canTrade).toBe(false); });
  it('requires the selected player’s turn to trade', () => { expect(strategyFacts({ ...input, isTurn: false }).canTrade).toBe(false); });
  it('requires movement to finish before trading', () => { expect(strategyFacts({ ...input, phase: 'moving' }).canTrade).toBe(false); });
});