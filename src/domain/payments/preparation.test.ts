import { describe, expect, it } from "vitest";
import {
  atomicAmount,
  atomicToEurc,
  eurcToAtomic,
  minorUnitsToEurcAtomic,
  refundAtomic,
} from "./token-amount";
import { createRefundObligation, planSettlement } from "./settlement";
import { quoteGameCancellation, quotePlayerCancellation } from "../refund";
import { demoGames } from "../demo-data";

const refund = (percent = 80, paymentId = "payment-a", recipientAddress = "player-a") =>
  createRefundObligation({
    id: `refund-${paymentId}`,
    gameId: "game",
    bookingId: `booking-${paymentId}`,
    paymentId,
    recipientAddress,
    paidAtomic: eurcToAtomic("7"),
    refundPercent: percent,
    refundMinorUnits: 2,
    reason: "player_cancelled",
    approvedAt: "2026-10-25T10:00:00Z",
  });
const plan = (refunds = [refund()], balance = "14", fee = "0.042") =>
  planSettlement({
    gameId: "game",
    organizerAddress: "organizer",
    balanceAtomic: eurcToAtomic(balance),
    quotedFeesAtomic: eurcToAtomic(fee),
    refunds,
  });

describe("EURC seven-decimal amounts", () => {
  it("converts cents, decimals and smallest token units exactly", () => {
    expect(minorUnitsToEurcAtomic(700, 2)).toBe("70000000");
    expect(eurcToAtomic("5.60")).toBe("56000000");
    expect(atomicToEurc("1")).toBe("0.0000001");
    expect(atomicToEurc(eurcToAtomic("123456789012345.1234567"))).toBe("123456789012345.1234567");
  });
  it.each(["-7", "1e3", "NaN", "1.00000001", " 7", "01"])("rejects invalid decimal %s", (v) =>
    expect(() => eurcToAtomic(v)).toThrow(),
  );
  it("rejects fractional minor units, unsafe integers, overflow and wrong precision", () => {
    expect(() => minorUnitsToEurcAtomic(1.2, 2)).toThrow();
    expect(() => minorUnitsToEurcAtomic(Number.MAX_SAFE_INTEGER + 1, 2)).toThrow();
    expect(() => minorUnitsToEurcAtomic(1, 8)).toThrow();
    expect(() => atomicAmount((1n << 127n).toString())).toThrow();
  });
});

describe("refund obligations and net settlement planning", () => {
  it("records 80% of 7 EURC as a 5.60 net entitlement, not a completed transfer", () => {
    expect(refund()).toMatchObject({ netAmountAtomic: "56000000", state: "approved" });
    expect(refund(100).netAmountAtomic).toBe("70000000");
    expect(refund(60).netAmountAtomic).toBe("42000000");
    expect(refund(0).netAmountAtomic).toBe("0");
    expect(() => refundAtomic("70000000", 101)).toThrow();
    expect(() => refundAtomic("70000000", 0.5)).toThrow();
    expect(refundAtomic(eurcToAtomic("0.01"), 80, 2)).toBe(eurcToAtomic("0.01"));
    expect(refundAtomic(eurcToAtomic("0.01"), 80, 7)).toBe(eurcToAtomic("0.008"));
  });
  it("matches existing configured 80% early and 100% game-cancellation quotes", () => {
    const game = demoGames[0]!;
    const configured = {
      ...game,
      cancellationPolicy: {
        ...game.cancellationPolicy,
        cutoffHours: 4,
        refundPercentBeforeCutoff: 80,
        refundPercentOnGameCancelled: 100,
      },
    };
    const early = new Date(Date.parse(game.startsAt) - 5 * 3600000);
    expect(minorUnitsToEurcAtomic(quotePlayerCancellation(configured, 700, early).refund, 2)).toBe(
      refund().netAmountAtomic,
    );
    expect(minorUnitsToEurcAtomic(quoteGameCancellation(configured, 700).refund, 2)).toBe(
      refund(100).netAmountAtomic,
    );
  });
  it("deducts explicit quoted fees from organizer proceeds while preserving player entitlement", () => {
    expect(plan()).toMatchObject({
      state: "draft",
      refundTotalAtomic: "56000000",
      organizerPayoutAtomic: "83580000",
      minimumAdditionalFundingAtomic: "0",
    });
    expect(plan([]).organizerPayoutAtomic).toBe("139580000");
    expect(plan([], "14", "0").organizerPayoutAtomic).toBe("140000000");
  });
  it("flags insufficient balance for 100% net refunds plus fees", () => {
    const p = plan([refund(100), refund(100, "payment-b", "player-b")]);
    expect(p).toMatchObject({
      state: "funding_required",
      organizerPayoutAtomic: "0",
      minimumAdditionalFundingAtomic: "420000",
    });
    expect(p.allocations.map((a) => a.netAmountAtomic)).toEqual(["70000000", "70000000"]);
  });
  it("conserves allocations plus fees for both funded and deficient plans", () => {
    for (const percent of [0, 60, 80, 100]) {
      for (const balance of ["0", "7", "14", "21"]) {
        const p = plan([refund(percent), refund(percent, "payment-b", "player-b")], balance);
        const allocations = p.allocations.reduce((n, a) => n + BigInt(a.netAmountAtomic), 0n);
        expect(allocations + BigInt(p.quotedFeesAtomic)).toBe(
          BigInt(p.balanceAtomic) + BigInt(p.minimumAdditionalFundingAtomic),
        );
      }
    }
  });
  it("aggregates multiple payments to a wallet and excludes zero allocations", () => {
    const p = plan([refund(80), refund(80, "payment-b", "player-a")], "21");
    expect(p.allocations[0]).toMatchObject({
      address: "player-a",
      netAmountAtomic: "112000000",
      obligationIds: ["refund-payment-a", "refund-payment-b"],
    });
    expect(plan([refund(0)]).allocations).toHaveLength(1);
  });
  it("rejects duplicate, wrong-game, paid or tampered refund obligations", () => {
    expect(() => plan([refund(), refund()])).toThrow(/Duplicate/);
    expect(() => plan([{ ...refund(), gameId: "other" }])).toThrow();
    expect(() => plan([{ ...refund(), state: "settled" }])).toThrow();
    expect(() => plan([{ ...refund(), netAmountAtomic: "70000000" }])).toThrow();
  });
});
