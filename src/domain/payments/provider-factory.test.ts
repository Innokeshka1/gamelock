// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { getBookingPaymentProvider, getPaymentProvider } from "./provider-factory.server";
import { mockPaymentProvider } from "./mock-provider";
import {
  readTrustlessWorkConfig,
  assertDepositorOnly,
  rolesForOrganizer,
} from "./stellar-config.server";
import { TrustlessWorkProvider } from "./trustless-work-provider.server";
import { demoGames } from "../demo-data";

const admin = "GC6AZBSQGDHSXSNYLVGYN7PLDHVR2XO5TYOL7VLJ62I2HS5UWSUKLYBX";
const resolver = "GDGT4GOHSABEPB5JFOX6HWBUGXWLJEWGAD4QBULUXS4YXKH2L5YV5K6P";
const organizer = "GDBZY43YA2WNTSGUB5VW3ZZE5VEGRNI5H3ZKDVFIITL3ZXUXAPOGWRV6";
const player = "GCE3TFBA33BOWCSYL5GHRPKGTHFTZ5G2EKK5AUZBQGZME5WFVNBLFCVG";
const env = {
  PAYMENT_PROVIDER: "trustless-work",
  TRUSTLESS_WORK_API_KEY: "synthetic-test-key-not-a-credential",
  TRUSTLESS_WORK_API_URL: "https://beta.api.trustlesswork.com",
  STELLAR_NETWORK: "testnet",
  STELLAR_NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
  STELLAR_RPC_URL: "https://soroban-testnet.stellar.org",
  STELLAR_HORIZON_URL: "https://horizon-testnet.stellar.org",
  EURC_SYMBOL: "EURC",
  EURC_DECIMALS: "7",
  EURC_ISSUER: "GB3Q6QDZYTHWT7E5PVS3W7FUT5GVAFC5KSZFFLPU25GO7VTC3NM2ZTVO",
  EURC_CONTRACT_ID: "CCUUDM434BMZMYWYDITHFXHDMIVTGGD6T2I5UKNX5BSLXLW7HVR4MCGZ",
  GAMELOCK_ADMIN_ADDRESS: admin,
  GAMELOCK_RESOLVER_ADDRESS: resolver,
  GAMELOCK_OPERATOR_ADDRESS: organizer,
  GAMELOCK_PLATFORM_ADDRESS: organizer,
};

describe("server provider selection and configuration", () => {
  it("defaults to the existing mock without requiring any Stellar secrets", () => {
    expect(getPaymentProvider({})).toBe(mockPaymentProvider);
    expect(getBookingPaymentProvider({ PAYMENT_PROVIDER: "mock" })).toBe(mockPaymentProvider);
    expect(() => getPaymentProvider({ PAYMENT_PROVIDER: "typo" })).toThrow();
  });
  it("keeps mock payment confirmation and refund_pending behavior", async () => {
    vi.useFakeTimers();
    try {
      const mock = getBookingPaymentProvider({});
      const created = await mock.createPayment({
        bookingId: "regression",
        amount: 700,
        currency: { code: "EUR", minorUnits: 2 },
      });
      expect(created.status).toBe("pending");
      const confirmed = mock.confirmPayment(created.providerRef);
      await vi.runAllTimersAsync();
      expect(await confirmed).toEqual({ status: "successful" });
      const refunded = mock.refundPayment(created.providerRef, 560);
      await vi.runAllTimersAsync();
      expect(await refunded).toEqual({ status: "refund_pending" });
    } finally {
      vi.useRealTimers();
    }
  });
  it("selects the scaffold but blocks legacy booking operations", async () => {
    const provider = getPaymentProvider(env);
    expect(provider).toBeInstanceOf(TrustlessWorkProvider);
    expect(() => getBookingPaymentProvider(env)).toThrow(/preparation-only/);
    await expect(provider.confirmPayment("unverified")).rejects.toThrow(/preparation-only/);
  });
  it("rejects wrong network, host, precision and role overlap without exposing secrets", () => {
    for (const change of [
      { STELLAR_NETWORK: "mainnet" },
      { TRUSTLESS_WORK_API_URL: "https://example.com" },
      { EURC_DECIMALS: "2" },
      { GAMELOCK_RESOLVER_ADDRESS: admin },
    ])
      expect(() => readTrustlessWorkConfig({ ...env, ...change })).toThrow();
    try {
      readTrustlessWorkConfig({ ...env, STELLAR_NETWORK: "mainnet" });
    } catch (e) {
      expect(String(e)).not.toContain(env.TRUSTLESS_WORK_API_KEY);
    }
  });
  it("keeps players out of every escrow role", () => {
    const roles = rolesForOrganizer(readTrustlessWorkConfig(env).stellar, organizer);
    expect(() => assertDepositorOnly(roles, player)).not.toThrow();
    for (const role of Object.values(roles))
      expect(() => assertDepositorOnly(roles, role)).toThrow(/depositors only/);
  });
  it("prepares only blocked drafts, without networking or secrets in output", () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(() => {
      throw new Error("Unexpected network call");
    });
    try {
      const provider = new TrustlessWorkProvider(readTrustlessWorkConfig(env));
      const result = provider.provisionEscrow({
        game: demoGames[0]!,
        organizerAddress: organizer,
        playerAddresses: [player],
      });
      expect(result).toMatchObject({
        status: "blocked",
        reason: "live_transport_disabled",
        draft: { escrow: { state: "not_provisioned" } },
      });
      expect(JSON.stringify(result)).not.toContain(env.TRUSTLESS_WORK_API_KEY);
      expect(result.draft.escrow.contractId).toBeUndefined();
      const attempt = {
        id: "attempt",
        paymentId: "payment",
        bookingId: "booking",
        gameId: result.draft.escrow.gameId,
        escrowContractId: "future-verified-contract",
        assetContractId: env.EURC_CONTRACT_ID,
        payerAddress: player,
        amountAtomic: "70000000",
        state: "created" as const,
      };
      const active = {
        ...result.draft.escrow,
        state: "active" as const,
        contractId: attempt.escrowContractId,
      };
      expect(provider.preparePayment({ escrow: active, attempt }).status).toBe("blocked");
      expect(() =>
        provider.preparePayment({
          escrow: active,
          attempt: { ...attempt, payerAddress: resolver },
        }),
      ).toThrow(/depositors only/);
      expect(provider.reconcilePayment(attempt).draft.state).toBe("reconciliation_required");
      const obligation = provider.recordRefundObligation({
        id: "refund",
        gameId: attempt.gameId,
        bookingId: "booking",
        paymentId: "payment",
        recipientAddress: player,
        paidAtomic: "70000000",
        refundPercent: 80,
        refundMinorUnits: 2,
        reason: "player_cancelled",
        approvedAt: "2026-10-25T10:00:00Z",
      });
      expect(obligation.reason).toBe("persistence_not_connected");
      const settlement = provider.prepareSettlement({
        gameId: attempt.gameId,
        organizerAddress: organizer,
        balanceAtomic: "140000000",
        quotedFeesAtomic: "420000",
        refunds: [obligation.draft],
      });
      expect(settlement.draft.disputeInitiator).toBe(organizer);
      expect(settlement.draft.resolutionSigner).toBe(resolver);
      expect(settlement.reason).toBe("fee_simulation_required");
      expect(
        provider.reconcileSettlement({
          id: "settlement",
          gameId: attempt.gameId,
          escrowContractId: active.contractId,
          state: "draft",
          plan: settlement.draft.plan,
        }).draft.state,
      ).toBe("reconciliation_required");
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      fetch.mockRestore();
    }
  });
});
