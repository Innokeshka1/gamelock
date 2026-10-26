import { createClientOnlyFn } from "@tanstack/react-start";
import { useSyncExternalStore } from "react";
import { cancelBookingFn, cancelGameFn, createBookingFn, createGameFn, getAppState, payBookingFn, nativeBookingPaymentFn, nativeBookingRefundFn } from "./data/api";
import { computeGameStatus, paidPlayerCount } from "./game-logic";
import type { Booking, Game, GameStatus, NewGameInput, Payment, Player, Refund } from "./types";

/**
 * App state, backed by the database. The root route loader fetches the state
 * and primes this store before render; every action calls a server function
 * and then refreshes from the database, so the UI always shows stored data.
 */
export interface State {
  games: Game[];
  bookings: Booking[];
  payments: Payment[];
  refunds: Refund[];
  fetchedAt: string;
}

const empty: State = { games: [], bookings: [], payments: [], refunds: [], fetchedAt: "" };
let state = empty;
let serverState = empty;
let primed: State | null = null;
const listeners = new Set<() => void>();

// Re-render at lifecycle boundaries even when a page is left open.
let lifecycleTimer: ReturnType<typeof setTimeout> | undefined;
function scheduleLifecycleUpdate() {
  clearTimeout(lifecycleTimer);
  if (!listeners.size) return;
  const now = Date.now();
  const next = Math.min(...state.games.flatMap((g) => [Date.parse(g.endsAt), Date.parse(g.confirmationDeadline) + 1]).filter((time) => time > now));
  if (!Number.isFinite(next)) return;
  lifecycleTimer = setTimeout(() => {
    state = { ...state };
    listeners.forEach((l) => l());
    scheduleLifecycleUpdate();
  }, Math.min(next - now, 2_147_483_647));
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  scheduleLifecycleUpdate();
  return () => {
    listeners.delete(l);
    if (!listeners.size) clearTimeout(lifecycleTimer);
  };
};

export function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state ?? empty), () => selector(serverState ?? empty));
}

/**
 * Load fresh data into the store. A snapshot older than the current one
 * (e.g. a stale route-loader result after a mutation) never overwrites it.
 * Listeners are notified after the current render, not during it.
 */
export function primeStore(next: State | undefined | null) {
  // Ignore missing or malformed snapshots (e.g. a failed loader result) —
  // the store keeps its last good state instead of blanking the UI.
  if (!next || !Array.isArray(next.games) || !Array.isArray(next.bookings)) return;
  if (next === primed || next.fetchedAt < state.fetchedAt) return;
  primed = next;
  state = next;
  serverState = next;
  scheduleLifecycleUpdate();
  queueMicrotask(() => listeners.forEach((l) => l()));
}

export async function refreshStore(): Promise<void> {
  primeStore(await getAppState());
}

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

// ---- Actions (server functions + refresh) ----
export async function createBooking(gameId: string, player: Omit<Player, "id">): Promise<string> {
  const { bookingId } = await createBookingFn({ data: { gameId, player } });
  await refreshStore();
  return bookingId;
}

const payNativeWithWallet = createClientOnlyFn(async (bookingId: string): Promise<boolean> => {
  const { connectPlayerWallet, signPlayerPayment } = await import("./payments/freighter.client");
  const payer = await connectPlayerWallet();
  const prepared = await nativeBookingPaymentFn({ data: { bookingId, payer } });
  if (prepared.status === "verified") { await refreshStore(); return true; }
  if (prepared.status !== "awaiting_signature") throw new Error("Payment is awaiting chain verification. Retry this booking; do not send another payment.");
  const signedXdr = await signPlayerPayment(prepared.xdr, payer);
  const completed = await nativeBookingPaymentFn({ data: { bookingId, payer, signedXdr } });
  await refreshStore();
  if (completed.status !== "verified") throw new Error(`Payment is not yet verified (${completed.hash}). Retry this booking to check the same transaction.`);
  return true;
});

export async function payBooking(bookingId: string): Promise<boolean> {
  const payment = state.payments.find(p => p.bookingId === bookingId);
  if (payment?.provider === "stellar-native") return Boolean(await payNativeWithWallet(bookingId));
  const { ok } = await payBookingFn({ data: { bookingId } });
  await refreshStore();
  return ok;
}

export async function cancelBooking(bookingId: string): Promise<void> {
  await cancelBookingFn({ data: { bookingId } });
  await refreshStore();
}

export async function cancelGame(gameId: string): Promise<void> {
  await cancelGameFn({ data: { gameId } });
  await refreshStore();
}

export async function createGame(input: NewGameInput): Promise<string> {
  const { gameId } = await createGameFn({ data: input });
  await refreshStore();
  return gameId;
}

export function useAppState(): State {
  return useStore((s) => s);
}

// Refund review and signing are separate user actions. No signing on preparation.
export const prepareNativeRefund = createClientOnlyFn(async (bookingId: string) => {
  const { connectPlayerWallet } = await import("./payments/freighter.client");
  const organizer = await connectPlayerWallet();
  const result = await nativeBookingRefundFn({ data: { bookingId, organizer } });
  await refreshStore();
  return result;
});

export const signNativeRefund = createClientOnlyFn(async (bookingId: string, xdr: string, organizer: string) => {
  const { signPlayerPayment } = await import("./payments/freighter.client");
  const signedXdr = await signPlayerPayment(xdr, organizer);
  const result = await nativeBookingRefundFn({ data: { bookingId, organizer, signedXdr } });
  await refreshStore();
  if (result.status !== "verified") throw new Error("Refund is not yet verified. Check this same refund again; do not send a separate transfer.");
  return result.hash;
});
