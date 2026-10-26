import "@tanstack/react-start/server-only";
import { createHash } from "node:crypto";
import {
  Account,
  Asset,
  BASE_FEE,
  Memo,
  Networks,
  Operation,
  StrKey,
  Transaction,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import type { PaymentProvider } from "./provider";
import type { Currency, PaymentStatus } from "../types";
import { atomicToEurc, eurcToAtomic, minorUnitsToEurcAtomic } from "./token-amount";

export const NATIVE_NETWORK = Networks.TESTNET;
export const NATIVE_HORIZON = "https://horizon-testnet.stellar.org";
export const NATIVE_ISSUER = "GB3Q6QDZYTHWT7E5PVS3W7FUT5GVAFC5KSZFFLPU25GO7VTC3NM2ZTVO";
export const NATIVE_TOKEN = "CCUUDM434BMZMYWYDITHFXHDMIVTGGD6T2I5UKNX5BSLXLW7HVR4MCGZ";
const asset = new Asset("EURC", NATIVE_ISSUER);
export interface NativePaymentContext {
  bookingId: string;
  amount: number;
  currency: Currency;
}
export interface NativeIntent {
  version: 1;
  xdr: string;
  hash: string;
  payer: string;
}
interface Balance {
  asset_type: string;
  asset_code?: string;
  asset_issuer?: string;
  balance: string;
  limit?: string;
  selling_liabilities?: string;
  buying_liabilities?: string;
  is_authorized?: boolean;
}
interface AccountData {
  sequence: string;
  balances: Balance[];
  subentry_count: number;
  num_sponsoring?: number;
  num_sponsored?: number;
}
interface ChainTransaction {
  successful: boolean;
  hash: string;
  source_account: string;
  envelope_xdr: string;
  ledger: number;
}
const memoFor = (bookingId: string) =>
  createHash("sha256").update(`gamelock:booking:${bookingId}`).digest("hex");
export const initialNativeRef = (bookingId: string) => `stellar-native:${bookingId}`;

export function nativeAmount(input: NativePaymentContext): string {
  if (input.currency.code !== "EUR")
    throw new Error("Native EURC payments require an EUR booking.");
  const atomic = minorUnitsToEurcAtomic(input.amount, input.currency.minorUnits);
  if (BigInt(atomic) <= 0n || BigInt(atomic) > (1n << 63n) - 1n)
    throw new Error("Invalid Stellar payment amount.");
  return atomicToEurc(atomic);
}

export function decodeNativeIntent(ref: string): NativeIntent {
  const value = JSON.parse(ref) as NativeIntent;
  if (
    value.version !== 1 ||
    typeof value.xdr !== "string" ||
    !/^[a-f0-9]{64}$/.test(value.hash) ||
    !StrKey.isValidEd25519PublicKey(value.payer)
  )
    throw new Error("Invalid saved Stellar payment intent.");
  return value;
}

/** Checks the complete immutable transaction body, including booking binding. */
export function inspectNativeTransaction(
  xdr: string,
  intent: NativeIntent,
  input: NativePaymentContext,
  receiver: string,
): Transaction {
  const tx = TransactionBuilder.fromXDR(xdr, NATIVE_NETWORK);
  if (!(tx instanceof Transaction)) throw new Error("Fee-bump transactions are not supported.");
  const op = tx.operations[0];
  if (
    Buffer.from(tx.hash()).toString("hex") !== intent.hash ||
    tx.source !== intent.payer ||
    tx.memo.type !== "hash" ||
    Buffer.from(tx.memo.value as Buffer).toString("hex") !== memoFor(input.bookingId) ||
    tx.operations.length !== 1 ||
    !op ||
    op.type !== "payment" ||
    (op.source ?? tx.source) !== intent.payer ||
    op.destination !== receiver ||
    op.asset.getCode() !== "EURC" ||
    op.asset.getIssuer() !== NATIVE_ISSUER ||
    eurcToAtomic(op.amount) !== eurcToAtomic(nativeAmount(input)) ||
    !tx.timeBounds ||
    Number(tx.timeBounds.maxTime) <= 0 ||
    BigInt(tx.fee) > 10000n
  ) {
    throw new Error("Stellar transaction does not match this booking's saved payment.");
  }
  return tx;
}

export class NativeStellarProvider implements PaymentProvider {
  readonly id = "stellar-native";
  readonly receiver: string;
  constructor(env: Record<string, string | undefined> = process.env) {
    this.receiver = env["GAMELOCK_RECEIVING_ADDRESS"] ?? "";
    if (!StrKey.isValidEd25519PublicKey(this.receiver))
      throw new Error("Configure GAMELOCK_RECEIVING_ADDRESS with a public Testnet account.");
    const pinned = {
      STELLAR_NETWORK: "testnet",
      STELLAR_NETWORK_PASSPHRASE: NATIVE_NETWORK,
      STELLAR_HORIZON_URL: NATIVE_HORIZON,
      EURC_SYMBOL: "EURC",
      EURC_ISSUER: NATIVE_ISSUER,
      EURC_CONTRACT_ID: NATIVE_TOKEN,
      EURC_DECIMALS: "7",
    };
    for (const [name, value] of Object.entries(pinned))
      if (env[name] !== undefined && env[name] !== value)
        throw new Error(`Native Testnet configuration mismatch: ${name}`);
    if (asset.contractId(NATIVE_NETWORK) !== NATIVE_TOKEN)
      throw new Error("EURC asset identity mismatch.");
  }
  async createPayment(input: NativePaymentContext) {
    nativeAmount(input);
    return { providerRef: initialNativeRef(input.bookingId), status: "pending" as const };
  }
  async confirmPayment(): Promise<{ status: PaymentStatus }> {
    throw new Error(
      "Native payment requires a wallet signature and booking-bound chain verification.",
    );
  }
  async refundPayment(): Promise<{ status: PaymentStatus }> {
    throw new Error("Native EURC refunds are not implemented.");
  }
  async getPaymentStatus(): Promise<PaymentStatus> {
    return "pending";
  }

  private async read(path: string): Promise<Response> {
    return fetch(NATIVE_HORIZON + path, {
      redirect: "error",
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    });
  }
  async prepare(
    input: NativePaymentContext,
    payer: string,
    expiresAt: number,
  ): Promise<NativeIntent> {
    if (!StrKey.isValidEd25519PublicKey(payer) || payer === this.receiver)
      throw new Error("Connect a player wallet different from the receiving wallet.");
    const amount = nativeAmount(input);
    const [from, to, ledgerResponse] = await Promise.all([
      this.read(`/accounts/${payer}`),
      this.read(`/accounts/${this.receiver}`),
      this.read("/ledgers?order=desc&limit=1"),
    ]);
    if (!from.ok || !to.ok || !ledgerResponse.ok)
      throw new Error("Could not load Testnet accounts. Both wallets must exist and have XLM.");
    const sender = (await from.json()) as AccountData;
    const receiver = (await to.json()) as AccountData;
    const ledger = await ledgerResponse.json();
    const reserve = BigInt(ledger._embedded.records[0].base_reserve_in_stroops);
    const line = (a: AccountData) =>
      a.balances.find((b) => b.asset_code === "EURC" && b.asset_issuer === NATIVE_ISSUER);
    const sourceLine = line(sender),
      destLine = line(receiver);
    if (!sourceLine?.is_authorized)
      throw new Error("Player wallet needs an authorized EURC Testnet trustline.");
    if (!destLine?.is_authorized)
      throw new Error("Receiving wallet needs an authorized EURC Testnet trustline.");
    const units = BigInt(eurcToAtomic(amount));
    if (
      BigInt(eurcToAtomic(sourceLine.balance)) -
        BigInt(eurcToAtomic(sourceLine.selling_liabilities ?? "0")) <
      units
    )
      throw new Error("Insufficient spendable EURC balance.");
    if (
      BigInt(eurcToAtomic(destLine.limit!)) -
        BigInt(eurcToAtomic(destLine.balance)) -
        BigInt(eurcToAtomic(destLine.buying_liabilities ?? "0")) <
      units
    )
      throw new Error("Receiving EURC trustline has insufficient capacity.");
    const xlm = sender.balances.find((b) => b.asset_type === "native");
    const minimum =
      BigInt(
        2 + sender.subentry_count + (sender.num_sponsoring ?? 0) - (sender.num_sponsored ?? 0),
      ) * reserve;
    if (
      !xlm ||
      BigInt(eurcToAtomic(xlm.balance)) -
        BigInt(eurcToAtomic(xlm.selling_liabilities ?? "0")) -
        minimum <
        BigInt(BASE_FEE)
    )
      throw new Error("Insufficient spendable XLM for the network fee.");
    const maxTime = Math.min(Math.floor(Date.now() / 1000) + 300, expiresAt);
    if (maxTime <= Math.floor(Date.now() / 1000) + 15)
      throw new Error("The booking payment window is closing.");
    const tx = new TransactionBuilder(new Account(payer, sender.sequence), {
      fee: BASE_FEE,
      networkPassphrase: NATIVE_NETWORK,
    })
      .addMemo(Memo.hash(memoFor(input.bookingId)))
      .addOperation(Operation.payment({ destination: this.receiver, asset, amount }))
      .setTimebounds(0, maxTime)
      .build();
    return { version: 1, xdr: tx.toXDR(), hash: Buffer.from(tx.hash()).toString("hex"), payer };
  }
  async verify(intent: NativeIntent, input: NativePaymentContext): Promise<boolean> {
    inspectNativeTransaction(intent.xdr, intent, input, this.receiver);
    const response = await this.read(`/transactions/${intent.hash}`);
    if (response.status === 404) return false;
    if (!response.ok)
      throw new Error(
        "Stellar verification unavailable. Retry this booking; do not send another payment.",
      );
    const tx = (await response.json()) as ChainTransaction;
    if (!tx.successful)
      throw new Error(
        "The saved Stellar transaction failed on-chain. No EURC payment was completed; manual reconciliation is required.",
      );
    if (tx.hash !== intent.hash || tx.source_account !== intent.payer || !(tx.ledger > 0))
      throw new Error("Unexpected Stellar transaction receipt.");
    inspectNativeTransaction(tx.envelope_xdr, intent, input, this.receiver);
    return true;
  }
  async submit(
    signedXdr: string,
    intent: NativeIntent,
    input: NativePaymentContext,
  ): Promise<boolean> {
    const tx = inspectNativeTransaction(signedXdr, intent, input, this.receiver);
    if (!tx.signatures.length) throw new Error("Freighter signature is required.");
    if (await this.verify(intent, input)) return true;
    if (Number(tx.timeBounds!.maxTime) <= Date.now() / 1000)
      throw new Error(
        "Saved payment expired. No new payment was created; manual reconciliation is required.",
      );
    // A timeout/rejected duplicate may still have landed. Always query the saved hash.
    try {
      await fetch(`${NATIVE_HORIZON}/transactions`, {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(20000),
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ tx: signedXdr }),
      });
    } catch {
      /* Verification below decides success, never the submission response. */
    }
    return this.verify(intent, input);
  }
}
