import { useSyncExternalStore } from "react";
import { demoGames, seedBookings } from "./demo-data";
import { computeGameStatus, paidPlayerCount } from "./game-logic";
import { paymentProvider } from "./payments/mock-provider";
import { quoteGameCancellation, quotePlayerCancellation } from "./refund";
import type { Booking, Game, GameStatus, Payment, Player, Refund } from "./types";

/** In-memory data layer for the prototype. Replace with an API later. */
export interface State {
  games: Game[];
  bookings: Booking[];
  payments: Payment[];
  refunds: Refund[];
}

const initial = (): State => ({ games: demoGames, refunds: [], ...seedBookings() });
const serverState = initial();
let state = initial();
const listeners = new Set<() => void>();

function set(next: Partial<State>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state), () => selector(serverState));
}

const uid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 9)}`;
const nowIso = () => new Date().toISOString();

// ---- Selectors ----
export interface GameView {
  game: Game;
  paid: number;
  status: GameStatus;
}

export function viewGame(s: State, game: Game, now = new Date()): GameView {
  const paid = paidPlayerCount(game.id, s.bookings, s.payments);
  return { game, paid, status: computeGameStatus(game, paid, now) };
}

// ---- Booking actions ----
export async function createBooking(gameId: string, player: Omit<Player, "id">): Promise<string> {
  const game = state.games.find((g) => g.id === gameId);
  if (!game) throw new Error("Game not found");
  const bookingId = uid("bk");
  const paymentId = uid("pay");
  const amount = game.pricePerPlayer;
  const { providerRef, status } = await paymentProvider.createPayment({ bookingId, amount, currency: game.currency });
  set({
    bookings: [...state.bookings, { id: bookingId, gameId, player: { ...player, id: uid("pl") }, spots: 1, status: "awaiting_payment", paymentId, createdAt: nowIso() }],
    payments: [...state.payments, { id: paymentId, bookingId, amount, currency: game.currency, status, providerRef, createdAt: nowIso() }],
  });
  return bookingId;
}

export async function payBooking(bookingId: string): Promise<boolean> {
  const booking = state.bookings.find((b) => b.id === bookingId);
  const payment = state.payments.find((p) => p.id === booking?.paymentId);
  if (!booking || !payment?.providerRef) return false;
  const { status } = await paymentProvider.confirmPayment(payment.providerRef);
  set({
    payments: state.payments.map((p) => (p.id === payment.id ? { ...p, status } : p)),
    bookings: state.bookings.map((b) => (b.id === bookingId && status === "successful" ? { ...b, status: "active" } : b)),
  });
  return status === "successful";
}

export async function cancelBooking(bookingId: string): Promise<void> {
  const booking = state.bookings.find((b) => b.id === bookingId);
  const payment = state.payments.find((p) => p.id === booking?.paymentId);
  const game = state.games.find((g) => g.id === booking?.gameId);
  if (!booking || !payment || !game) return;
  const q = quotePlayerCancellation(game, payment.amount, new Date());
  let paymentStatus = payment.status;
  if (q.eligible && payment.providerRef) {
    paymentStatus = (await paymentProvider.refundPayment(payment.providerRef, q.refund)).status;
  }
  const refund: Refund = {
    id: uid("rf"), paymentId: payment.id, amount: q.refund, fee: q.fee, currency: payment.currency,
    status: q.eligible ? "initiated" : "not_eligible", reason: "player_cancelled", createdAt: nowIso(),
  };
  set({
    refunds: [...state.refunds, refund],
    payments: state.payments.map((p) => (p.id === payment.id ? { ...p, status: paymentStatus } : p)),
    bookings: state.bookings.map((b) => (b.id === bookingId ? { ...b, status: "cancelled", refundId: refund.id } : b)),
  });
}

export async function cancelGame(gameId: string): Promise<void> {
  const game = state.games.find((g) => g.id === gameId);
  if (!game) return;
  const active = state.bookings.filter((b) => b.gameId === gameId && b.status === "active");
  const ids = new Set(active.map((b) => b.paymentId));
  const refunds: Refund[] = [];
  for (const p of state.payments.filter((p) => ids.has(p.id) && p.status === "successful")) {
    const q = quoteGameCancellation(game, p.amount);
    if (p.providerRef) await paymentProvider.refundPayment(p.providerRef, q.refund);
    refunds.push({ id: uid("rf"), paymentId: p.id, amount: q.refund, fee: q.fee, currency: p.currency, status: "initiated", reason: "game_cancelled", createdAt: nowIso() });
  }
  set({
    games: state.games.map((g) => (g.id === gameId ? { ...g, cancelledAt: nowIso(), cancelReason: "organizer" } : g)),
    payments: state.payments.map((p) => (ids.has(p.id) && p.status === "successful" ? { ...p, status: "refund_pending" } : p)),
    refunds: [...state.refunds, ...refunds],
  });
}
