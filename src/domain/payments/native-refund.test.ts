// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TransactionBuilder, xdr } from "@stellar/stellar-sdk";
import { NativeStellarProvider, inspectNativeTransaction, NATIVE_ISSUER, NATIVE_NETWORK, type NativeIntent } from "./native-stellar.server";
import { refundTransfer, verifyOriginalPayment, type NativeRefundRecord } from "./native-refund.server";
const organizer = "GDBZY43YA2WNTSGUB5VW3ZZE5VEGRNI5H3ZKDVFIITL3ZXUXAPOGWRV6";
const payer = "GCE3TFBA33BOWCSYL5GHRPKGTHFTZ5G2EKK5AUZBQGZME5WFVNBLFCVG";
const context = { bookingId: "booking", amount: 700, currency: { code: "EUR", minorUnits: 2 } };
let original: NativeIntent;
let refund: NativeIntent;
let record: NativeRefundRecord;
const network = vi.fn();
beforeEach(async () => {
  vi.stubEnv("GAMELOCK_RECEIVING_ADDRESS", organizer);
  network.mockReset().mockImplementation(async (url: string) => {
    if (url.includes("/transactions/")) return new Response(null, { status: 404 });
    if (url.includes("/ledgers?")) return Response.json({ _embedded: { records: [{ base_reserve_in_stroops: 5000000 }] } });
    return Response.json({ sequence: "123", subentry_count: 1, balances: [
      { asset_type: "native", balance: "100" },
      { asset_type: "credit_alphanum4", asset_code: "EURC", asset_issuer: NATIVE_ISSUER, balance: "27", limit: "1000", is_authorized: true },
    ] });
  });
  vi.stubGlobal("fetch", network);
  original = await new NativeStellarProvider().prepare(context, payer, Math.floor(Date.now() / 1000) + 300);
  record = { kind: "stellar-native-refund-v1", paymentHash: original.hash, payer, amount: 560, reason: "player_cancelled", requestedAt: new Date().toISOString() };
  const transfer = refundTransfer("payment", record, context);
  refund = await transfer.provider.prepare(transfer.context, organizer, Math.floor(Date.now() / 1000) + 300);
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const receipt = (intent: NativeIntent) => ({ successful: true, hash: intent.hash, source_account: intent.payer, envelope_xdr: intent.xdr, ledger: 123 });

describe("native EURC refund chain boundary", () => {
  it("recovers payer from a successful original receipt and rejects other bookings/amounts/recipients", async () => {
    network.mockResolvedValue(Response.json(receipt(original)));
    expect(await verifyOriginalPayment(original.hash, context, organizer)).toBe(payer);
    for (const altered of [{ ...context, bookingId: "other" }, { ...context, amount: 701 }]) {
      network.mockResolvedValue(Response.json(receipt(original)));
      await expect(verifyOriginalPayment(original.hash, altered, organizer)).rejects.toThrow(/does not match/);
    }
    network.mockResolvedValue(Response.json(receipt(original)));
    await expect(verifyOriginalPayment(original.hash, context, payer)).rejects.toThrow(/does not match/);
  });
  it("rejects failed or unavailable original receipts", async () => {
    network.mockResolvedValue(Response.json({ ...receipt(original), successful: false }));
    await expect(verifyOriginalPayment(original.hash, context, organizer)).rejects.toThrow(/not successful/);
    network.mockResolvedValue(new Response(null, { status: 503 }));
    await expect(verifyOriginalPayment(original.hash, context, organizer)).rejects.toThrow(/unavailable/);
  });
  it("builds exactly 5.6 EURC from Organizer to payer with a refund-specific memo, unsigned", () => {
    const transfer = refundTransfer("payment", record, context);
    const tx = inspectNativeTransaction(refund.xdr, refund, transfer.context, payer);
    expect(tx.source).toBe(organizer);
    expect(tx.operations).toMatchObject([{ type: "payment", destination: payer, amount: "5.6000000" }]);
    expect(tx.signatures).toHaveLength(0);
    expect(() => inspectNativeTransaction(original.xdr, original, transfer.context, payer)).toThrow();
    expect(() => inspectNativeTransaction(refund.xdr, refund, refundTransfer("other", record, context).context, payer)).toThrow();
    expect(() => refundTransfer("payment", { ...record, amount: 701 }, context)).toThrow();
    expect(() => refundTransfer("payment", { ...record, amount: 0 }, context)).toThrow();
  });
  it("verifies only the saved refund body, not the original payment receipt", async () => {
    const transfer = refundTransfer("payment", record, context);
    network.mockResolvedValueOnce(Response.json(receipt(original)));
    await expect(transfer.provider.verify(refund, transfer.context)).rejects.toThrow();
    network.mockResolvedValueOnce(Response.json(receipt(refund)));
    expect(await transfer.provider.verify(refund, transfer.context)).toBe(true);
  });
  it("requires a signature and never treats an ambiguous submission as success", async () => {
    const transfer = refundTransfer("payment", record, context);
    await expect(transfer.provider.submit(refund.xdr, refund, transfer.context)).rejects.toThrow(/signature/);
    const tx = TransactionBuilder.fromXDR(refund.xdr, NATIVE_NETWORK);
    tx.signatures.push(new xdr.DecoratedSignature({ hint: Buffer.alloc(4), signature: Buffer.alloc(64) }));
    network.mockImplementation(async (_url: string, options?: RequestInit) => {
      if (options?.method === "POST") throw new Error("Timeout");
      return new Response(null, { status: 404 });
    });
    expect(await transfer.provider.submit(tx.toXDR(), refund, transfer.context)).toBe(false);
  });
});
