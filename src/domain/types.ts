// Core domain types. Nothing here is sport-, city- or currency-specific.

export interface Currency {
  code: string; // ISO 4217, e.g. "EUR"
  minorUnits: number; // decimals, e.g. 2
}

/** Money is stored in minor units (cents) to avoid float errors. */
export interface Money {
  amount: number;
  currency: Currency;
}

export interface Sport {
  id: string;
  name: string;
}

export interface Venue {
  id: string;
  name: string;
  address: string;
  city: string;
  country: string; // ISO 3166 alpha-2
  timeZone: string; // IANA
  mapsUrl: string;
}

export interface Organizer {
  id: string;
  name: string;
}

export interface CancellationPolicy {
  /** Hours before start after which the late refund applies. */
  cutoffHours: number;
  refundPercentBeforeCutoff: number;
  refundPercentAfterCutoff: number;
  /** Refund when the organizer cancels or min players isn't reached. */
  refundPercentOnGameCancelled: number;
}

export type GameStatus = "pending" | "confirmed" | "sold_out" | "cancelled";

export interface Game {
  id: string;
  sport: Sport;
  title: string;
  venue: Venue;
  organizer: Organizer;
  startsAt: string; // ISO UTC
  endsAt: string;
  confirmationDeadline: string;
  currency: Currency;
  pricePerPlayer: number; // minor units
  minPlayers: number;
  maxPlayers: number;
  cancellationPolicy: CancellationPolicy;
  organizerFeePercent: number;
  whatToBring: string[];
  cancelledAt?: string;
  cancelReason?: "organizer" | "min_not_reached";
}

export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | undefined;
  phone?: string | undefined;
}

export type PaymentStatus =
  | "pending"
  | "successful"
  | "failed"
  | "refund_pending"
  | "refund_completed";

export interface Payment {
  id: string;
  bookingId: string;
  amount: number;
  currency: Currency;
  status: PaymentStatus;
  providerRef?: string;
  createdAt: string;
}

export type RefundStatus = "initiated" | "completed" | "not_eligible";

export interface Refund {
  id: string;
  paymentId: string;
  amount: number;
  fee: number;
  currency: Currency;
  status: RefundStatus;
  reason: "player_cancelled" | "game_cancelled";
  createdAt: string;
}

export type BookingStatus = "awaiting_payment" | "active" | "cancelled";

export interface Booking {
  id: string;
  gameId: string;
  player: Player;
  spots: number;
  status: BookingStatus;
  paymentId: string;
  refundId?: string;
  createdAt: string;
}
