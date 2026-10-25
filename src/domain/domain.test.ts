import { describe, expect, it } from "vitest";
import { demoGames } from "./demo-data";
import { computeGameStatus } from "./game-logic";
import { quoteGameCancellation, quotePlayerCancellation } from "./refund";

const game = demoGames[0]; // min 10, max 15, €7, starts 2026-10-29T20:00Z
const early = new Date("2026-10-25T12:00:00Z");

describe("game status", () => {
  it("pending below minimum", () => expect(computeGameStatus(game, 7, early)).toBe("pending"));
  it("confirmed at minimum", () => expect(computeGameStatus(game, 10, early)).toBe("confirmed"));
  it("sold out at maximum", () => expect(computeGameStatus(game, 15, early)).toBe("sold_out"));
  it("cancelled when deadline passes below minimum", () =>
    expect(computeGameStatus(game, 9, new Date("2026-10-29T13:00:00Z"))).toBe("cancelled"));
  it("cancelled when organizer cancels", () =>
    expect(computeGameStatus({ ...game, cancelledAt: "x" }, 12, early)).toBe("cancelled"));
});

describe("refunds", () => {
  it("80% refund more than 4h before", () => {
    const q = quotePlayerCancellation(game, 700, early);
    expect(q.refund).toBe(560);
    expect(q.fee).toBe(140);
  });
  it("no refund less than 4h before", () => {
    const q = quotePlayerCancellation(game, 700, new Date("2026-10-29T17:00:00Z"));
    expect(q.eligible).toBe(false);
    expect(q.refund).toBe(0);
  });
  it("full refund when game cancelled", () => expect(quoteGameCancellation(game, 700).refund).toBe(700));
});
