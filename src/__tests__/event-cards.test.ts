import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
// js/cards.js is a plain browser script; run it and grab its exports.
const mod = { exports: {} as any };
new Function("module", readFileSync(resolve(__dirname, "../../js/cards.js"), "utf8"))(mod);
const C = mod.exports;

const p = (money: number, shares: number) => ({ money, shares });

describe("Event Cards", () => {
  it("Dividend Bonus pays 300 per share", () => expect(C.cardOutcome(1, p(0, 4), 500).dm).toBe(1200));
  it("Investment Tax charges 300 per share; unable -> penalty", () => {
    expect(C.cardOutcome(2, p(5000, 4), 500).dm).toBe(-1200);
    expect(C.cardOutcome(2, p(100, 4), 500).ok).toBe(false);
  });
  it("Shareholder Reward 500 at 5+ shares else 200", () => {
    expect(C.cardOutcome(3, p(0, 5), 1).dm).toBe(500);
    expect(C.cardOutcome(3, p(0, 4), 1).dm).toBe(200);
  });
  it("Annual Holding Fee 100 per share", () => expect(C.cardOutcome(4, p(9999, 3), 1).dm).toBe(-300));
  it("Investor Grant 1000 at 10+ else 300", () => {
    expect(C.cardOutcome(5, p(0, 10), 1).dm).toBe(1000);
    expect(C.cardOutcome(5, p(0, 9), 1).dm).toBe(300);
  });
  it("Emergency Contribution 50 per share", () => expect(C.cardOutcome(6, p(9999, 3), 1).dm).toBe(-150));
  it("Mandatory Hold freezes trading", () => expect(C.cardOutcome(7, p(0, 0), 1).hold).toBe(true));
  it("Forced Sale sells 3 at market; fewer than 3 -> penalty", () => {
    expect(C.cardOutcome(8, p(0, 3), 400)).toMatchObject({ ok: true, dm: 1200, ds: -3 });
    expect(C.cardOutcome(8, p(0, 2), 400).ok).toBe(false);
  });
  it("Forced Purchase buys 3 at market; short cash -> penalty", () => {
    expect(C.cardOutcome(9, p(1200, 0), 400)).toMatchObject({ ok: true, dm: -1200, ds: 3 });
    expect(C.cardOutcome(9, p(1199, 0), 400).ok).toBe(false);
  });
  it("Investor's Choice: 2500 cash, buy 5, or sell 5", () => {
    expect(C.cardOutcome(10, p(0, 0), 100, "cash").dm).toBe(2500);
    expect(C.cardOutcome(10, p(500, 0), 100, "buy").ds).toBe(5);
    expect(C.cardOutcome(10, p(0, 4), 100, "sell").ok).toBe(false);
  });
  it("10 Event Card Tiles at least 7 apart, also after shuffling", () => {
    for (let r = 0; r < 200; r++) {
      const slots = C.spacedSlots(10, 0, 99, 7);
      const tiles = Array.from({ length: 100 }, (_, i) => (slots.includes(i) ? C.CARD_TILE_TEXT : "T" + i));
      expect(C.minCardGap(tiles)).toBeGreaterThanOrEqual(7);
      const from = Math.floor(Math.random() * 60);
      const after = C.shuffleAheadTexts(tiles, from);
      expect(after.filter((t: string) => t === C.CARD_TILE_TEXT).length).toBe(10);
      expect(C.minCardGap(after)).toBeGreaterThanOrEqual(7);
    }
  });
});
