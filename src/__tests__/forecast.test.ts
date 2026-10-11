import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const cards = { exports: {} as any };
new Function("module", readFileSync(resolve(__dirname, "../../js/cards.js"), "utf8"))(cards);
const src = readFileSync(resolve(__dirname, "../../js/rules.js"), "utf8");

function load(phase: string, mode = "long", pool: string[] = ["Retail Surge (+4)"]) {
  const S: any = { marketPhase: phase, settings: { mode }, eventPool: pool, players: [], tiles: [] };
  const EVENT_SETS = { crypto: ["Withdrawal Halt (-9)"] };
  const R = new Function("APP_STATE", "EVENT_SETS", "shuffleAheadTexts", "marketValue",
    src + "\nreturn { phaseBonus, reshuffleAhead };")(S, EVENT_SETS, cards.exports.shuffleAheadTexts, () => 500);
  return { S, R };
}
const lo = () => 0, hi = () => 0.999;

describe("Forecast on landing", () => {
  it("Neutral adds nothing", () => expect(load("neutral").R.phaseBonus(5, 500, hi)).toBe(0));
  it("Classic Bull adds 3-5% of the share price", () => {
    const { R } = load("bull");
    expect(R.phaseBonus(5, 500, lo)).toBe(15);
    expect(R.phaseBonus(5, 500, hi)).toBe(25);
  });
  it("Classic Bear subtracts 3-5%, even on a plus Tile", () => {
    const { R } = load("bear");
    expect(R.phaseBonus(10, 500, lo)).toBe(-15);
    expect(R.phaseBonus(10, 500, hi)).toBe(-25);
  });
  it("Crypto swings 6-10%", () => {
    const { R } = load("bull", "long", ["Withdrawal Halt (-9)"]);
    expect(R.phaseBonus(1, 500, lo)).toBe(30);
    expect(R.phaseBonus(1, 500, hi)).toBe(50);
  });
});

describe("Reshuffle", () => {
  it("never changes a Tile an avatar stands on", () => {
    const { S, R } = load("neutral");
    S.tiles = Array.from({ length: 100 }, (_, i) => ({ number: i + 1, text: "T" + i }));
    S.players = [{ position: 10 }, { position: 40 }];
    for (let k = 0; k < 20; k++) { R.reshuffleAhead(); expect(S.tiles[9].text).toBe("T9"); expect(S.tiles[39].text).toBe("T39"); }
  });
});
