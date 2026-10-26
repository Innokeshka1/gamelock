import type { RefundObligation, SettlementPlan } from "./escrow-types";
import { atomicAmount, refundAtomic } from "./token-amount";

export function createRefundObligation(
  input: Omit<RefundObligation, "netAmountAtomic" | "state">,
): RefundObligation {
  if (
    ![input.id, input.gameId, input.bookingId, input.paymentId, input.recipientAddress].every(
      Boolean,
    )
  )
    throw new Error("Refund identity is required");
  if (!Number.isFinite(Date.parse(input.approvedAt)))
    throw new Error("Refund approval time is invalid");
  return {
    ...input,
    netAmountAtomic: refundAtomic(input.paidAtomic, input.refundPercent, input.refundMinorUnits),
    state: "approved",
  };
}

/** Pure net-entitlement plan. Fee quote is supplied explicitly, never assumed to be measured. */
export function planSettlement(input: {
  gameId: string;
  organizerAddress: string;
  balanceAtomic: string;
  quotedFeesAtomic: string;
  refunds: RefundObligation[];
}): SettlementPlan {
  if (!input.gameId || !input.organizerAddress) throw new Error("Game and organizer are required");
  const balance = atomicAmount(input.balanceAtomic);
  const fees = atomicAmount(input.quotedFeesAtomic);
  const ids = new Set<string>();
  const payments = new Set<string>();
  const recipients = new Map<string, { amount: bigint; ids: string[] }>();
  let refunds = 0n;
  for (const r of input.refunds) {
    if (r.gameId !== input.gameId || !["approved", "settlement_pending"].includes(r.state))
      throw new Error("Refund is not eligible for this settlement");
    if (ids.has(r.id) || payments.has(r.paymentId))
      throw new Error("Duplicate refund/payment; consolidate entitlement before settlement");
    ids.add(r.id);
    payments.add(r.paymentId);
    if (!r.recipientAddress || r.recipientAddress === input.organizerAddress)
      throw new Error("Refund recipient must be a player, not the organizer");
    const n = atomicAmount(r.netAmountAtomic);
    if (
      n > atomicAmount(r.paidAtomic) ||
      r.netAmountAtomic !== refundAtomic(r.paidAtomic, r.refundPercent, r.refundMinorUnits)
    )
      throw new Error("Refund entitlement does not match its policy");
    refunds += n;
    const recipient = recipients.get(r.recipientAddress) ?? { amount: 0n, ids: [] };
    recipient.amount += n;
    recipient.ids.push(r.id);
    recipients.set(r.recipientAddress, recipient);
  }
  const remainder = balance - refunds - fees;
  const payout = remainder > 0n ? remainder : 0n;
  const shortage = remainder < 0n ? -remainder : 0n;
  const allocations: SettlementPlan["allocations"] = [...recipients]
    .filter(([, v]) => v.amount > 0n)
    .map(([address, v]) => ({
      address,
      netAmountAtomic: v.amount.toString(),
      obligationIds: v.ids,
      kind: "refund",
    }));
  if (payout > 0n)
    allocations.push({
      address: input.organizerAddress,
      netAmountAtomic: payout.toString(),
      obligationIds: [],
      kind: "organizer",
    });
  if (allocations.length > 50) throw new Error("Settlement exceeds 50 recipient limit");
  return {
    gameId: input.gameId,
    state: shortage > 0n ? "funding_required" : "draft",
    balanceAtomic: balance.toString(),
    quotedFeesAtomic: fees.toString(),
    refundTotalAtomic: refunds.toString(),
    organizerPayoutAtomic: payout.toString(),
    minimumAdditionalFundingAtomic: shortage.toString(),
    allocations,
  };
}
