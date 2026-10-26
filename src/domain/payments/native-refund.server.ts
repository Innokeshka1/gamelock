import "@tanstack/react-start/server-only";
import { z } from "zod";
import { StrKey } from "@stellar/stellar-sdk";
import { decodeNativeIntent, inspectNativeTransaction, NativeStellarProvider, NATIVE_HORIZON, type NativePaymentContext } from "./native-stellar.server";

const hash = z.string().regex(/^[a-f0-9]{64}$/);
const refundSchema = z.object({
  kind: z.literal("stellar-native-refund-v1"),
  paymentHash: hash,
  payer: z.string().refine(StrKey.isValidEd25519PublicKey),
  amount: z.number().int().nonnegative(),
  reason: z.enum(["player_cancelled", "game_cancelled"]),
  requestedAt: z.string().datetime(),
  // A single immutable, unsigned intent. Never expose it in the app snapshot.
  intent: z.string().optional(),
  refundHash: hash.optional(),
});
export type NativeRefundRecord = z.infer<typeof refundSchema>;

export function readNativeRefund(ref: string | null): NativeRefundRecord | null {
  if (!ref?.startsWith("{")) return null;
  const value = JSON.parse(ref);
  if (value.kind !== "stellar-native-refund-v1") return null;
  return refundSchema.parse(value);
}

/** Recover the recipient only from the independently verified original receipt. */
export async function verifyOriginalPayment(paymentHash: string, context: NativePaymentContext, organizer: string) {
  hash.parse(paymentHash);
  const response = await fetch(`${NATIVE_HORIZON}/transactions/${paymentHash}`, {
    redirect: "error", signal: AbortSignal.timeout(15000), cache: "no-store",
  });
  if (!response.ok) throw new Error("Original payment verification unavailable. No refund was prepared.");
  const receipt = await response.json();
  if (!receipt.successful || receipt.hash !== paymentHash || !(receipt.ledger > 0))
    throw new Error("Original payment is not successful on-chain.");
  const intent = decodeNativeIntent(JSON.stringify({ version: 1, xdr: receipt.envelope_xdr, hash: paymentHash, payer: receipt.source_account }));
  inspectNativeTransaction(intent.xdr, intent, context, organizer);
  return intent.payer;
}

export function refundTransfer(paymentId: string, record: NativeRefundRecord, context: NativePaymentContext) {
  if (record.amount <= 0 || record.amount > context.amount) throw new Error("Invalid refund amount.");
  const provider = new NativeStellarProvider({ ...process.env, GAMELOCK_RECEIVING_ADDRESS: record.payer });
  // Separate memo namespace prevents replay of the original payment or another refund.
  const refundContext = { ...context, bookingId: `refund:${paymentId}:${record.paymentHash}`, amount: record.amount };
  return { provider, context: refundContext };
}
