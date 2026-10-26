import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cancelled: false,
  insert: vi.fn(), update: vi.fn(), delete: vi.fn(),
  confirmPayment: vi.fn(), refundPayment: vi.fn(), createPayment: vi.fn(),
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: (table: string) => {
      const game = {
        id: "historical", title: "Historical game", sport: "Basketball", venue: "Court", city: "Lisbon",
        starts_at: "2026-10-20T18:00:00Z", ends_at: "2026-10-20T20:00:00Z",
        confirmation_deadline: "2026-10-20T12:00:00Z", minimum_players: 1, maximum_players: 10,
        cancelled_at: mocks.cancelled ? "2026-10-19T12:00:00Z" : null,
      };
      const payment = { id: "payment", status: "pending", external_reference: "mock-ref" };
      const booking = { id: "booking", game_id: game.id, status: "pending", spots: 1, payments: payment };
      const query = {
        select: () => query, eq: () => query,
        maybeSingle: async () => ({ data: table === "games" ? game : table === "payments" ? payment : booking, error: null }),
        then: (resolve: (result: object) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve),
        insert: mocks.insert, update: mocks.update, delete: mocks.delete,
      };
      return query;
    },
  }),
}));
vi.mock("../payments/provider-factory.server", () => ({ getBookingPaymentProvider: () => ({
  confirmPayment: mocks.confirmPayment, refundPayment: mocks.refundPayment, createPayment: mocks.createPayment,
}) }));
import { cancelBookingRecord, cancelGameRecord, createBookingRecord, payBookingRecord } from "./db.server";

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-21T12:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe.each([false, true])("server lifecycle guards (cancelled=%s)", (cancelled) => {
  beforeEach(() => { mocks.cancelled = cancelled; });
  it.each([
    ["booking", () => createBookingRecord("historical", { firstName: "Test", lastName: "Player" })],
    ["payment", () => payBookingRecord("booking")],
    ["booking cancellation", () => cancelBookingRecord("booking")],
    ["game cancellation", () => cancelGameRecord("historical")],
  ] as const)("rejects %s without modifying history or calling the provider", async (_name, action) => {
    await expect(action()).rejects.toThrow();
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.delete).not.toHaveBeenCalled();
    expect(mocks.confirmPayment).not.toHaveBeenCalled();
    expect(mocks.refundPayment).not.toHaveBeenCalled();
    expect(mocks.createPayment).not.toHaveBeenCalled();
  });
});
