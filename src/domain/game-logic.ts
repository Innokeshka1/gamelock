import type { Booking, Game, GameStatus, Payment } from "./types";

export function paidPlayerCount(gameId: string, bookings: Booking[], payments: Payment[]): number {
  const paid = new Set(payments.filter((p) => p.status === "successful").map((p) => p.id));
  return bookings
    .filter((b) => b.gameId === gameId && b.status === "confirmed" && paid.has(b.paymentId))
    .reduce((n, b) => n + b.spots, 0);
}

export function computeGameStatus(game: Game, paidPlayers: number, now: Date): GameStatus {
  if (game.cancelledAt) return "cancelled";
  if (now.getTime() >= new Date(game.endsAt).getTime()) return "completed";
  if (paidPlayers >= game.maxPlayers) return "sold_out";
  if (paidPlayers >= game.minPlayers) return "confirmed";
  if (now.getTime() > new Date(game.confirmationDeadline).getTime()) return "cancelled";
  return "pending";
}

export function spotsLeft(game: Game, paidPlayers: number): number {
  return Math.max(0, game.maxPlayers - paidPlayers);
}

export function canBook(status: GameStatus): boolean {
  return status === "pending" || status === "confirmed";
}

export function hoursUntilStart(game: Game, now: Date): number {
  return (new Date(game.startsAt).getTime() - now.getTime()) / 3_600_000;
}

export function canCancelGame(status: GameStatus): boolean {
  return status !== "cancelled" && status !== "completed";
}

export function canPayBooking(status: GameStatus, booking: Booking, payment: Payment): boolean {
  return canBook(status) && booking.status === "pending" &&
    (payment.status === "pending" || payment.status === "failed");
}

/** Allows checking a possibly submitted native payment after the game window closes. */
export function canReconcileNativePayment(booking: Booking, payment: Payment): boolean {
  return payment.provider === "stellar-native" && booking.status === "pending" &&
    (payment.status === "pending" || payment.status === "successful");
}

export function isBookingPaid(booking: Booking, payment: Payment): boolean {
  return booking.status === "confirmed" && payment.status === "successful";
}

export function canCancelBooking(status: GameStatus, booking: Booking): boolean {
  return canCancelGame(status) && (booking.status === "pending" || booking.status === "confirmed");
}
