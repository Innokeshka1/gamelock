/** Preparation-only domain contracts. No SDK, UI, environment variables or secrets. */
export type AtomicAmount = string; // Nonnegative integer base units; validated by token utilities.
export type EscrowState =
  | "not_provisioned"
  | "provisioning"
  | "awaiting_signature"
  | "active"
  | "disputed"
  | "settled"
  | "failed";
export type PaymentAttemptState =
  | "created"
  | "awaiting_signature"
  | "submitted"
  | "confirmed"
  | "failed"
  | "expired"
  | "reconciliation_required";
export type RefundObligationState =
  "requested" | "approved" | "settlement_pending" | "settled" | "rejected";
export type SettlementState =
  | "draft"
  | "funding_required"
  | "awaiting_operator_signature"
  | "awaiting_resolver_signature"
  | "submitted"
  | "confirmed"
  | "failed"
  | "reconciliation_required";

export interface EscrowRoles {
  admin: string;
  operator: string;
  resolver: string;
  platform: string;
  organizer: string;
}
export interface GameEscrow {
  gameId: string;
  network: "testnet";
  protocol: "v2-beta";
  type: "single-release";
  assetContractId: string;
  roles: EscrowRoles;
  state: EscrowState;
  contractId?: string;
  deploymentHash?: string;
}
export interface PaymentAttempt {
  id: string;
  paymentId: string;
  bookingId: string;
  gameId: string;
  escrowContractId: string;
  assetContractId: string;
  payerAddress: string;
  amountAtomic: AtomicAmount;
  state: PaymentAttemptState;
  transactionHash?: string;
  confirmedLedger?: number;
}
export interface RefundObligation {
  id: string;
  gameId: string;
  bookingId: string;
  paymentId: string;
  recipientAddress: string;
  paidAtomic: AtomicAmount;
  refundPercent: number;
  /** Snapshot from Game.currency.minorUnits; preserve business-price rounding. */
  refundMinorUnits: number;
  netAmountAtomic: AtomicAmount;
  reason: "player_cancelled" | "game_cancelled" | "min_not_reached";
  state: RefundObligationState;
  approvedAt: string;
  settlementId?: string;
}
export interface SettlementAllocation {
  address: string;
  /** Net entitlement, NOT a Trustless Work gross distribution payload. */
  netAmountAtomic: AtomicAmount;
  obligationIds: string[];
  kind: "refund" | "organizer";
}
export interface SettlementPlan {
  gameId: string;
  state: "draft" | "funding_required";
  balanceAtomic: AtomicAmount;
  quotedFeesAtomic: AtomicAmount;
  refundTotalAtomic: AtomicAmount;
  organizerPayoutAtomic: AtomicAmount;
  /** Shortfall at this fee quote; additional funding requires a fresh fee quote. */
  minimumAdditionalFundingAtomic: AtomicAmount;
  allocations: SettlementAllocation[];
}
export interface Settlement {
  id: string;
  gameId: string;
  escrowContractId: string;
  state: SettlementState;
  plan: SettlementPlan;
  disputeHash?: string;
  resolutionHash?: string;
  actualFeesAtomic?: AtomicAmount;
}

export interface StellarTestnetConfig {
  network: "testnet";
  networkPassphrase: "Test SDF Network ; September 2015";
  rpcUrl: string;
  horizonUrl: string;
  asset: { symbol: "EURC"; decimals: 7; issuer: string; contractId: string };
  roles: Omit<EscrowRoles, "organizer">;
}
