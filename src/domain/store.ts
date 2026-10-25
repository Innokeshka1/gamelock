import { useSyncExternalStore } from "react";
import { cancelBookingFn, cancelGameFn, createBookingFn, createGameFn, getAppState, payBookingFn } from "./data/api";
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

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
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

export async function payBooking(bookingId: string): Promise<boolean> {
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
