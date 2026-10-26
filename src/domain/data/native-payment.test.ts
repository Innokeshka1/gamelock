// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const memory = vi.hoisted(() => ({
  rows: {} as Record<string, Record<string, unknown>[]>,
  writes: [] as string[],
  failBooking: false,
  failCompletedBooking: false,
  loseIntentRace: false,
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: (table: string) => {
      const filters: ((row: Record<string, unknown>) => boolean)[] = [];
      let patch: Record<string, unknown> | undefined;
      const execute = () => {
        const rows = memory.rows[table]!.filter((row) => filters.every((f) => f(row)));
        if (patch) {
          if (table === "bookings" && (memory.failBooking || (memory.failCompletedBooking && patch["status"] === "refunded")))
            return { data: null, error: new Error("DB unavailable") };
          if (
            table === "payments" &&
            memory.loseIntentRace &&
            String(patch["external_reference"]).startsWith("{")
          )
            return { data: [], error: null };
          memory.writes.push(`${table}:${patch["status"] ?? "intent"}`);
          rows.forEach((row) => Object.assign(row, patch));
        }
        return { data: rows.map((row) => ({ ...row })), error: null };
      };
      const query = {
        upsert: async (value: Record<string, unknown>) => {
          const existing = memory.rows[table]!.find(row => row["id"] === value["id"]);
          if (!existing) memory.rows[table]!.push({ ...value });
          return { data: null, error: null };
        },
        select: () => query,
        eq: (key: string, value: unknown) => {
          filters.push((row) => row[key] === value);
          return query;
        },
        in: (key: string, values: unknown[]) => {
          filters.push((row) => values.includes(row[key]));
          return query;
        },
        update: (value: Record<string, unknown>) => {
          patch = value;
          return query;
        },
        maybeSingle: async () => {
          const result = execute();
          return { ...result, data: result.data?.[0] ?? null };
        },
        then: (resolve: (result: unknown) => unknown) => Promise.resolve(execute()).then(resolve),
      };
      return query;
    },
  }),
}));
import {
  nativeBookingPayment,
  payBookingRecord,
  cancelBookingRecord,
  cancelGameRecord,
  requestNativeRefund,
  nativeBookingRefund,
} from "./db.server";
import * as refundModule from "../payments/native-refund.server";
import { NativeStellarProvider, initialNativeRef } from "../payments/native-stellar.server";
const receiver = "GDBZY43YA2WNTSGUB5VW3ZZE5VEGRNI5H3ZKDVFIITL3ZXUXAPOGWRV6";
const payer = "GCE3TFBA33BOWCSYL5GHRPKGTHFTZ5G2EKK5AUZBQGZME5WFVNBLFCVG";
let intent: Awaited<ReturnType<NativeStellarProvider["prepare"]>>;
let verify: ReturnType<typeof vi.spyOn>;
beforeEach(async () => {
  vi.stubEnv("PAYMENT_PROVIDER", "stellar-native");
  vi.stubEnv("GAMELOCK_RECEIVING_ADDRESS", receiver);
  memory.writes = [];
  memory.failBooking = false;
  memory.failCompletedBooking = false;
  memory.loseIntentRace = false;
  memory.rows = {
    refunds: [],
    payments: [
      {
        id: "payment",
        booking_id: "booking",
        provider: "stellar-native",
        amount: 700,
        currency: "EUR",
        status: "pending",
        external_reference: initialNativeRef("booking"),
      },
    ],
    bookings: [{ id: "booking", game_id: "game", status: "pending", spots: 1 }],
    games: [
      {
        id: "game",
        title: "Test",
        sport: "Football",
        venue: "Court",
        city: "Lisbon",
        currency: "EUR",
        price_per_player: 700,
        starts_at: "2099-01-01T12:00:00Z",
        ends_at: "2099-01-01T13:00:00Z",
        confirmation_deadline: "2099-01-01T10:00:00Z",
        cancellation_cutoff_hours: 4,
        refund_percentage: 80,
        refund_percentage_after_cutoff: 0,
        refund_percentage_on_game_cancelled: 100,
        minimum_players: 1,
        maximum_players: 10,
      },
    ],
  };
  // Build a real unsigned XDR using synthetic read-only Horizon responses.
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      Response.json(
        url.includes("/ledgers?")
          ? { _embedded: { records: [{ base_reserve_in_stroops: 5000000 }] } }
          : {
              sequence: "123",
              subentry_count: 1,
              balances: [
                { asset_type: "native", balance: "100" },
                {
                  asset_type: "credit_alphanum4",
                  asset_code: "EURC",
                  asset_issuer: "GB3Q6QDZYTHWT7E5PVS3W7FUT5GVAFC5KSZFFLPU25GO7VTC3NM2ZTVO",
                  balance: "20",
                  limit: "1000",
                  is_authorized: true,
                },
              ],
            },
      ),
    ),
  );
  intent = await new NativeStellarProvider().prepare(
    { bookingId: "booking", amount: 700, currency: { code: "EUR", minorUnits: 2 } },
    payer,
    Math.floor(Date.now() / 1000) + 300,
  );
  vi.spyOn(NativeStellarProvider.prototype, "prepare").mockResolvedValue(intent);
  verify = vi.spyOn(NativeStellarProvider.prototype, "verify").mockResolvedValue(false);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("native payment persistence boundary", () => {
  it("persists an immutable intent before returning XDR, never marking it paid", async () => {
    const response = await nativeBookingPayment({ bookingId: "booking", payer });
    expect(response.status).toBe("awaiting_signature");
    expect(memory.rows["payments"]![0]!["external_reference"]).toBe(JSON.stringify(intent));
    expect(memory.writes).toEqual(["payments:intent"]);
    const retry = await nativeBookingPayment({ bookingId: "booking", payer });
    expect(retry).toEqual(response);
    expect(NativeStellarProvider.prototype.prepare).toHaveBeenCalledTimes(1);
  });
  it("does not return a second intent when another request won the database race", async () => {
    memory.loseIntentRace = true;
    await expect(nativeBookingPayment({ bookingId: "booking", payer })).rejects.toThrow(/Another/);
    expect(memory.writes).toEqual([]);
  });
  it("does not mark successful when submission has not been verified", async () => {
    memory.rows["payments"]![0]!["external_reference"] = JSON.stringify(intent);
    vi.spyOn(NativeStellarProvider.prototype, "submit").mockResolvedValue(false);
    expect(
      (await nativeBookingPayment({ bookingId: "booking", payer, signedXdr: "synthetic" })).status,
    ).toBe("pending");
    expect(memory.writes).toEqual([]);
  });
  it("records verified hash first and repairs a failed booking write without another payment", async () => {
    memory.rows["payments"]![0]!["external_reference"] = JSON.stringify(intent);
    verify.mockResolvedValue(true);
    memory.failBooking = true;
    await expect(nativeBookingPayment({ bookingId: "booking", payer })).rejects.toThrow(
      /DB unavailable/,
    );
    expect(memory.rows["payments"]![0]).toMatchObject({
      status: "successful",
      external_reference: intent.hash,
    });
    memory.failBooking = false;
    expect(await nativeBookingPayment({ bookingId: "booking", payer })).toEqual({
      status: "verified",
      hash: intent.hash,
    });
    expect(memory.rows["bookings"]![0]!["status"]).toBe("confirmed");
    expect(NativeStellarProvider.prototype.prepare).not.toHaveBeenCalled();
  });
  it("reconciles a landed payment even after game expiry", async () => {
    memory.rows["payments"]![0]!["external_reference"] = JSON.stringify(intent);
    memory.rows["games"]![0]!["ends_at"] = "2000-01-01T00:00:00Z";
    verify.mockResolvedValue(true);
    expect((await nativeBookingPayment({ bookingId: "booking", payer })).status).toBe("verified");
  });
  it("blocks mock confirmation and cancellation of unverified native payments", async () => {
    await expect(payBookingRecord("booking")).rejects.toThrow(/wallet/);
    memory.rows["bookings"]![0]!["payments"] = memory.rows["payments"]![0];
    await expect(cancelBookingRecord("booking")).rejects.toThrow(/confirmed/);
    // This mock explicitly supplies the joined relation for the game guard.
    memory.rows["bookings"]![0]!["payments"] = memory.rows["payments"]![0];
    memory.rows["payments"]![0]!["external_reference"] = JSON.stringify(intent);
    await expect(cancelGameRecord("game")).rejects.toThrow(/Reconcile/);
    expect(memory.writes).toEqual([]);
  });
});

const payRow = () => memory.rows["payments"]![0]!;
const bookRow = () => memory.rows["bookings"]![0]!;
const record = () => refundModule.readNativeRefund(String(payRow()["external_reference"]))!;
const refundInput = { bookingId: "booking", organizer: receiver };
async function requestRefund() { return requestNativeRefund("booking"); }

describe("native refund persistence", () => {
  beforeEach(() => {
    payRow()["status"] = "successful";
    payRow()["external_reference"] = "a".repeat(64);
    bookRow()["status"] = "confirmed";
    bookRow()["payments"] = payRow();
    vi.spyOn(refundModule, "verifyOriginalPayment").mockResolvedValue(payer);
  });
  it("freezes an 80% request once, preserves original hash and does not mark refunded", async () => {
    await requestRefund();
    expect(record()).toMatchObject({ amount: 560, payer, paymentHash: "a".repeat(64), reason: "player_cancelled" });
    expect(payRow()["status"]).toBe("refund_pending");
    expect(bookRow()["status"]).toBe("cancelled");
    memory.rows["games"]![0]!["refund_percentage"] = 100;
    await requestRefund();
    expect(record().amount).toBe(560);
    expect(memory.rows["refunds"]).toHaveLength(1);
    expect(memory.rows["refunds"]![0]!["status"]).toBe("pending");
  });
  it("repairs an interrupted cancellation without creating another refund", async () => {
    memory.failBooking = true;
    await expect(requestRefund()).rejects.toThrow(/DB unavailable/);
    memory.failBooking = false;
    await requestRefund();
    expect(bookRow()["status"]).toBe("cancelled");
    expect(memory.rows["refunds"]).toHaveLength(1);
  });
  it.each([3, 4])("cancels at %i hours with zero refund and no transaction", async hours => {
    memory.rows["games"]![0]!["starts_at"] = new Date(Date.now() + hours * 3600000).toISOString();
    await requestRefund();
    expect(record().amount).toBe(0);
    expect(await nativeBookingRefund(refundInput)).toEqual({ status: "no_refund" });
    expect(payRow()["status"]).toBe("successful");
    expect(NativeStellarProvider.prototype.prepare).not.toHaveBeenCalled();
  });
  it("records 100% on organizer game cancellation and resumes idempotently", async () => {
    await cancelGameRecord("game");
    expect(record()).toMatchObject({ amount: 700, reason: "game_cancelled" });
    expect(memory.rows["games"]![0]!["cancel_reason"]).toBe("organizer");
    await cancelGameRecord("game");
    expect(memory.rows["refunds"]).toHaveLength(1);
  });
  it("refuses an unverified original payment before writing cancellation", async () => {
    vi.mocked(refundModule.verifyOriginalPayment).mockRejectedValueOnce(new Error("Receipt mismatch"));
    await expect(requestRefund()).rejects.toThrow(/Receipt/);
    expect(memory.writes).toEqual([]);
  });
  it("only returns the one persisted refund intent and rejects a different signer", async () => {
    await requestRefund();
    await expect(nativeBookingRefund({ ...refundInput, organizer: payer })).rejects.toThrow(/Organizer/);
    const transfer = refundModule.refundTransfer("payment", record(), { bookingId: "booking", amount: 700, currency: { code: "EUR", minorUnits: 2 } });
    vi.mocked(NativeStellarProvider.prototype.prepare).mockRestore();
    const refundIntent = await transfer.provider.prepare(transfer.context, receiver, Math.floor(Date.now() / 1000) + 300);
    vi.spyOn(NativeStellarProvider.prototype, "prepare").mockResolvedValue(refundIntent);
    const first = await nativeBookingRefund(refundInput);
    expect(first).toMatchObject({ status: "awaiting_signature", payer, organizer: receiver, amount: "5.6000000" });
    expect(record().intent).toBe(JSON.stringify(refundIntent));
    expect(await nativeBookingRefund(refundInput)).toEqual(first);
    expect(NativeStellarProvider.prototype.prepare).toHaveBeenCalledTimes(1);
  });
  it("does not return an intent when it loses the compare-and-set race", async () => {
    await requestRefund();
    memory.loseIntentRace = true;
    await expect(nativeBookingRefund(refundInput)).rejects.toThrow(/state changed/);
    expect(record().intent).toBeUndefined();
  });
  it("keeps an unverified submission pending and never replaces an expired intent", async () => {
    await requestRefund();
    const transfer = refundModule.refundTransfer("payment", record(), { bookingId: "booking", amount: 700, currency: { code: "EUR", minorUnits: 2 } });
    vi.mocked(NativeStellarProvider.prototype.prepare).mockRestore();
    const realIntent = await transfer.provider.prepare(transfer.context, receiver, Math.floor(Date.now() / 1000) + 300);
    payRow()["external_reference"] = JSON.stringify({ ...record(), intent: JSON.stringify(realIntent) });
    const submit = vi.spyOn(NativeStellarProvider.prototype, "submit").mockResolvedValue(false);
    expect(await nativeBookingRefund({ ...refundInput, signedXdr: "synthetic" })).toEqual({ status: "pending", hash: realIntent.hash });
    expect(payRow()["status"]).toBe("refund_pending");
    expect(memory.rows["refunds"]![0]!["status"]).toBe("pending");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 301000);
    try {
      await expect(nativeBookingRefund(refundInput)).rejects.toThrow(/expired/);
      expect(record().intent).toBe(JSON.stringify(realIntent));
      expect(submit).toHaveBeenCalledTimes(1);
    } finally { vi.useRealTimers(); }
  });
  it("records only verified refunds and repairs an interrupted final booking write", async () => {
    await requestRefund();
    // Verification is mocked here; body/memo/direction validation is tested against real XDR separately.
    const refundIntent = { ...intent, payer: receiver };
    payRow()["external_reference"] = JSON.stringify({ ...record(), intent: JSON.stringify(refundIntent) });
    verify.mockResolvedValue(true);
    memory.failCompletedBooking = true;
    await expect(nativeBookingRefund(refundInput)).rejects.toThrow(/DB unavailable/);
    expect(payRow()["status"]).toBe("refunded");
    expect(bookRow()["status"]).toBe("cancelled");
    memory.failCompletedBooking = false;
    const result = await nativeBookingRefund(refundInput);
    expect(result).toEqual({ status: "verified", hash: intent.hash });
    expect(record()).toMatchObject({ paymentHash: "a".repeat(64), refundHash: intent.hash });
    expect(payRow()["status"]).toBe("refunded");
    expect(bookRow()["status"]).toBe("refunded");
    bookRow()["status"] = "cancelled";
    expect(await nativeBookingRefund(refundInput)).toEqual(result);
    expect(bookRow()["status"]).toBe("refunded");
    expect(NativeStellarProvider.prototype.prepare).not.toHaveBeenCalled();
    expect(memory.rows["refunds"]).toHaveLength(1);
  });
});
