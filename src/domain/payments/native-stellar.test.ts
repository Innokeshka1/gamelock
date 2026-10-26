// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Account, Asset, Memo, Operation, TransactionBuilder, xdr } from "@stellar/stellar-sdk";
import { getBookingPaymentProvider } from "./provider-factory.server";
import {
  inspectNativeTransaction,
  NativeStellarProvider,
  NATIVE_ISSUER,
  NATIVE_NETWORK,
  nativeAmount,
} from "./native-stellar.server";

const payer = "GCE3TFBA33BOWCSYL5GHRPKGTHFTZ5G2EKK5AUZBQGZME5WFVNBLFCVG";
const receiver = "GDBZY43YA2WNTSGUB5VW3ZZE5VEGRNI5H3ZKDVFIITL3ZXUXAPOGWRV6";
const other = "GDGT4GOHSABEPB5JFOX6HWBUGXWLJEWGAD4QBULUXS4YXKH2L5YV5K6P";
const context = { bookingId: "booking-one", amount: 700, currency: { code: "EUR", minorUnits: 2 } };
const env = { PAYMENT_PROVIDER: "stellar-native", GAMELOCK_RECEIVING_ADDRESS: receiver };
const provider = new NativeStellarProvider(env);
const asset = new Asset("EURC", NATIVE_ISSUER);
const account = () => ({
  sequence: "123",
  subentry_count: 1,
  balances: [
    { asset_type: "native", balance: "100.0000000", selling_liabilities: "0" },
    {
      asset_type: "credit_alphanum4",
      asset_code: "EURC",
      asset_issuer: NATIVE_ISSUER,
      balance: "20.0000000",
      limit: "1000",
      is_authorized: true,
      selling_liabilities: "0",
      buying_liabilities: "0",
    },
  ],
});
let sender: ReturnType<typeof account>;
let destination: ReturnType<typeof account>;
const network = vi.fn();
beforeEach(() => {
  sender = account();
  destination = account();
  network.mockReset().mockImplementation(async (url: string) => {
    if (url.endsWith(`/accounts/${payer}`)) return Response.json(sender);
    if (url.endsWith(`/accounts/${receiver}`)) return Response.json(destination);
    if (url.includes("/ledgers?"))
      return Response.json({ _embedded: { records: [{ base_reserve_in_stroops: 5000000 }] } });
    return new Response(null, { status: 404 });
  });
  vi.stubGlobal("fetch", network);
});
afterEach(() => vi.unstubAllGlobals());
const prepare = () => provider.prepare(context, payer, Math.floor(Date.now() / 1000) + 300);

describe("native Testnet EURC provider", () => {
  it("selects through the factory and refuses unsafe configuration or generic confirmation", async () => {
    expect(getBookingPaymentProvider(env)).toBeInstanceOf(NativeStellarProvider);
    expect(() => new NativeStellarProvider({ ...env, STELLAR_NETWORK: "mainnet" })).toThrow();
    expect(() => new NativeStellarProvider({ ...env, EURC_ISSUER: other })).toThrow();
    await expect(provider.confirmPayment()).rejects.toThrow(/verification/);
    await expect(provider.refundPayment()).rejects.toThrow(/not implemented/);
    expect(nativeAmount(context)).toBe("7.0000000");
    expect(() => nativeAmount({ ...context, currency: { code: "USD", minorUnits: 2 } })).toThrow();
    expect(() => nativeAmount({ ...context, amount: 7.5 })).toThrow();
  });
  it("builds only one exact EURC payment with a booking hash memo and no signatures", async () => {
    const intent = await prepare();
    const tx = inspectNativeTransaction(intent.xdr, intent, context, receiver);
    expect(tx.signatures).toHaveLength(0);
    expect(tx.operations).toMatchObject([
      { type: "payment", destination: receiver, amount: "7.0000000" },
    ]);
    expect(Number(tx.timeBounds!.maxTime)).toBeLessThanOrEqual(Math.floor(Date.now() / 1000) + 300);
    expect(network.mock.calls.every((c) => !c[1]?.method)).toBe(true);
  });
  it.each([
    "missing",
    "wrongIssuer",
    "unauthorized",
    "balance",
    "liabilities",
    "xlm",
    "receiverMissing",
    "receiverLimit",
  ])("rejects readiness problem: %s", async (problem) => {
    if (problem === "missing") sender.balances.pop();
    if (problem === "wrongIssuer") sender.balances[1]!.asset_issuer = other;
    if (problem === "unauthorized") sender.balances[1]!.is_authorized = false;
    if (problem === "balance") sender.balances[1]!.balance = "6.9999999";
    if (problem === "liabilities") sender.balances[1]!.selling_liabilities = "14";
    if (problem === "xlm") sender.balances[0]!.balance = "1.5";
    if (problem === "receiverMissing") destination.balances.pop();
    if (problem === "receiverLimit") destination.balances[1]!.limit = "21";
    await expect(prepare()).rejects.toThrow();
  });
  it("rejects another booking, sender, receiver, asset, amount or additional operation", async () => {
    const intent = await prepare();
    expect(() =>
      inspectNativeTransaction(
        intent.xdr,
        intent,
        { ...context, bookingId: "booking-two" },
        receiver,
      ),
    ).toThrow();
    expect(() => inspectNativeTransaction(intent.xdr, intent, context, other)).toThrow();
    for (const variant of ["sender", "receiver", "amount", "asset", "extra"]) {
      const original = inspectNativeTransaction(intent.xdr, intent, context, receiver);
      const b = new TransactionBuilder(new Account(variant === "sender" ? other : payer, "123"), {
        fee: "100",
        networkPassphrase: NATIVE_NETWORK,
      })
        .addMemo(Memo.hash(original.memo.value as Buffer))
        .addOperation(
          Operation.payment({
            destination: variant === "receiver" ? other : receiver,
            amount: variant === "amount" ? "8" : "7",
            asset: variant === "asset" ? Asset.native() : asset,
          }),
        )
        .setTimebounds(0, Number(original.timeBounds!.maxTime));
      if (variant === "extra")
        b.addOperation(Operation.payment({ destination: other, amount: "1", asset }));
      const tx = b.build();
      // Even if a forged intent's hash matches, semantic checks reject it.
      expect(() =>
        inspectNativeTransaction(
          tx.toXDR(),
          { ...intent, hash: Buffer.from(tx.hash()).toString("hex") },
          context,
          receiver,
        ),
      ).toThrow();
    }
  });
  it("requires a successful independently fetched receipt, with the expected hash and envelope", async () => {
    const intent = await prepare();
    expect(await provider.verify(intent, context)).toBe(false);
    const receipt = {
      successful: true,
      hash: intent.hash,
      source_account: payer,
      envelope_xdr: intent.xdr,
      ledger: 1234,
    };
    network.mockResolvedValue(Response.json(receipt));
    expect(await provider.verify(intent, context)).toBe(true);
    for (const change of [
      { successful: false },
      { hash: "0".repeat(64) },
      { source_account: other },
      { ledger: 0 },
    ]) {
      network.mockResolvedValueOnce(Response.json({ ...receipt, ...change }));
      await expect(provider.verify(intent, context)).rejects.toThrow();
    }
  });
  it("rejects unsigned submission and verifies after an ambiguous submission timeout", async () => {
    const intent = await prepare();
    await expect(provider.submit(intent.xdr, intent, context)).rejects.toThrow(/signature/);
    const tx = inspectNativeTransaction(intent.xdr, intent, context, receiver);
    // Synthetic signature bytes only; no private keys or real submissions in tests.
    tx.signatures.push(
      new xdr.DecoratedSignature({ hint: Buffer.alloc(4), signature: Buffer.alloc(64, 1) }),
    );
    network
      .mockReset()
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce(
        Response.json({
          successful: true,
          hash: intent.hash,
          source_account: payer,
          envelope_xdr: tx.toXDR(),
          ledger: 1234,
        }),
      );
    expect(await provider.submit(tx.toXDR(), intent, context)).toBe(true);
    expect(network.mock.calls[1]![1].method).toBe("POST");
  });
});
