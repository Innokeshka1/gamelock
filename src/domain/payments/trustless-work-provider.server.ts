import "@tanstack/react-start/server-only";
import type { PaymentProvider } from "./provider";
import type { Game } from "../types";
import type {
  GameEscrow,
  PaymentAttempt,
  RefundObligation,
  Settlement,
  SettlementPlan,
} from "./escrow-types";
import { atomicAmount, minorUnitsToEurcAtomic } from "./token-amount";
import { createRefundObligation, planSettlement } from "./settlement";
import {
  assertDepositorOnly,
  rolesForOrganizer,
  type TrustlessWorkServerConfig,
} from "./stellar-config.server";

export type PreparationBlocker =
  | "live_transport_disabled"
  | "chain_verifier_not_connected"
  | "persistence_not_connected"
  | "fee_simulation_required";
export interface BlockedPreparation<T> {
  status: "blocked";
  reason: PreparationBlocker;
  draft: T;
}
const blocked = <T>(reason: PreparationBlocker, draft: T): BlockedPreparation<T> => ({
  status: "blocked",
  reason,
  draft,
});

export class ProviderNotReadyError extends Error {
  constructor() {
    super(
      "Trustless Work V2 beta is preparation-only; live booking payments are not enabled. Keep PAYMENT_PROVIDER=mock.",
    );
  }
}

/** No fetch, signing, submission or invented XDR/hash. Live methods stay explicitly blocked. */
export class TrustlessWorkProvider implements PaymentProvider {
  readonly id = "trustless-work";
  readonly mode = "preparation-only";
  #config: TrustlessWorkServerConfig;
  constructor(config: TrustlessWorkServerConfig) {
    this.#config = config;
  }

  async createPayment(): ReturnType<PaymentProvider["createPayment"]> {
    throw new ProviderNotReadyError();
  }
  async confirmPayment(): ReturnType<PaymentProvider["confirmPayment"]> {
    throw new ProviderNotReadyError();
  }
  async refundPayment(): ReturnType<PaymentProvider["refundPayment"]> {
    throw new ProviderNotReadyError();
  }
  async getPaymentStatus(): ReturnType<PaymentProvider["getPaymentStatus"]> {
    throw new ProviderNotReadyError();
  }

  provisionEscrow(input: {
    game: Game;
    organizerAddress: string;
    playerAddresses: string[];
  }): BlockedPreparation<{
    escrow: GameEscrow;
    configuredAmountAtomic: string;
    engagementId: string;
  }> {
    const { game } = input;
    if (game.currency.code !== "EUR")
      throw new Error("EURC preparation currently supports EUR-priced games only");
    if (!Number.isSafeInteger(game.maxPlayers) || game.maxPlayers <= 0)
      throw new Error("Invalid game capacity");
    const roles = rolesForOrganizer(this.#config.stellar, input.organizerAddress);
    for (const address of input.playerAddresses) assertDepositorOnly(roles, address);
    const price = atomicAmount(
      minorUnitsToEurcAtomic(game.pricePerPlayer, game.currency.minorUnits),
    );
    if (price === 0n) throw new Error("Escrow requires a positive price");
    const configuredAmountAtomic = (price * BigInt(game.maxPlayers)).toString();
    atomicAmount(configuredAmountAtomic);
    return blocked("live_transport_disabled", {
      escrow: {
        gameId: game.id,
        network: "testnet",
        protocol: "v2-beta",
        type: "single-release",
        assetContractId: this.#config.stellar.asset.contractId,
        roles,
        state: "not_provisioned",
      },
      configuredAmountAtomic,
      engagementId: game.id,
    });
  }

  preparePayment(input: {
    escrow: GameEscrow;
    attempt: PaymentAttempt;
  }): BlockedPreparation<PaymentAttempt> {
    const { escrow, attempt } = input;
    if (escrow.state !== "active" || !escrow.contractId)
      throw new Error("Payment requires an active verified escrow");
    if (
      attempt.gameId !== escrow.gameId ||
      attempt.escrowContractId !== escrow.contractId ||
      attempt.assetContractId !== escrow.assetContractId ||
      escrow.assetContractId !== this.#config.stellar.asset.contractId
    )
      throw new Error("Payment does not match game escrow/asset");
    if (attempt.state !== "created" || attempt.transactionHash || attempt.confirmedLedger)
      throw new Error("Reconcile existing attempts before preparing another payment");
    if (atomicAmount(attempt.amountAtomic) <= 0n) throw new Error("Payment must be positive");
    // Also guard current authority config; never rely solely on a caller-supplied role snapshot.
    assertDepositorOnly(
      rolesForOrganizer(this.#config.stellar, escrow.roles.organizer),
      attempt.payerAddress,
    );
    assertDepositorOnly(escrow.roles, attempt.payerAddress);
    return blocked("live_transport_disabled", { ...attempt });
  }

  reconcilePayment(attempt: PaymentAttempt): BlockedPreparation<PaymentAttempt> {
    // No caller status is promoted to confirmed without independently verified token transfers.
    return blocked("chain_verifier_not_connected", {
      ...attempt,
      state: "reconciliation_required",
    });
  }

  recordRefundObligation(
    input: Omit<RefundObligation, "netAmountAtomic" | "state">,
  ): BlockedPreparation<RefundObligation> {
    // Produces the record to persist later; never claims durable recording or sends a refund.
    return blocked("persistence_not_connected", createRefundObligation(input));
  }

  prepareSettlement(
    input: Parameters<typeof planSettlement>[0],
  ): BlockedPreparation<{
    plan: SettlementPlan;
    disputeInitiator: string;
    resolutionSigner: string;
  }> {
    const roles = rolesForOrganizer(this.#config.stellar, input.organizerAddress);
    for (const refund of input.refunds) assertDepositorOnly(roles, refund.recipientAddress);
    return blocked("fee_simulation_required", {
      plan: planSettlement(input),
      disputeInitiator: roles.operator,
      resolutionSigner: roles.resolver,
    });
  }

  reconcileSettlement(settlement: Settlement): BlockedPreparation<Settlement> {
    return blocked("chain_verifier_not_connected", {
      ...settlement,
      state: "reconciliation_required",
    });
  }
}
