import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function engine() {
  const state = { players: [{ id: 1, position: 0, money: 5000, shares: 9 }], currentPlayerIndex: 0, turnPhase: "trade", holdBy: "", evtSeq: 0, pending: 5 };
  const source = readFileSync(resolve(__dirname, "../../js/game.js"), "utf8");
  const api = new Function("APP_STATE", "MP", "marketValue", "setTimeout", "stepMsFor", `${source}\npublish = () => {}; return { trade: authTrade, accept: authAccept };`)(state, { on: false }, () => 500, () => 0, () => 340);
  return { state, api };
}

describe("Trading after moving", () => {
  it("buys immediately after movement, without waiting for End turn", () => {
    const { state, api } = engine();
    expect(api.trade(1, "buy", 2)).toBe(true);
    expect(state.players[0]).toMatchObject({ money: 4000, shares: 11 });
  });
  it("sells immediately after movement", () => {
    const { state, api } = engine();
    expect(api.trade(1, "sell", 3)).toBe(true);
    expect(state.players[0]).toMatchObject({ money: 6500, shares: 6 });
  });
  it("cannot trade before the move finishes", () => {
    const { state, api } = engine(); state.turnPhase = "moving";
    expect(api.trade(1, "buy", 1)).toBe(false);
    expect(state.players[0]?.shares).toBe(9);
  });
  it("Mandatory Hold still blocks buying and selling", () => {
    const { state, api } = engine(); Object.assign(state, { holdBy: 1 });
    expect(api.trade(1, "buy", 1)).toBe(false);
    expect(api.trade(1, "sell", 1)).toBe(false);
  });
  it("a roll of 5 from the empty Tile 0 lands on Tile 5", () => {
    const { state, api } = engine(); state.turnPhase = "accept";
    api.accept(1);
    expect(state.players[0]?.position).toBe(5);
  });
});