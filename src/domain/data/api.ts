// Public server functions for GameLock data. No authentication yet — the MVP
// is fully public. UI and store call these; the database stays behind them.
import { createServerFn } from "@tanstack/react-start";
import type { NewGameInput, Player } from "../types";

// POST so the browser never serves a cached snapshot — state changes constantly.
export const getAppState = createServerFn({ method: "POST" }).handler(async () => {
  const { fetchState } = await import("./db.server");
  return fetchState();
});

export const getGameMeta = createServerFn({ method: "GET" })
  .inputValidator((input: { gameId: string }) => input)
  .handler(async ({ data }) => {
    const { fetchGameMeta } = await import("./db.server");
    return fetchGameMeta(data.gameId);
  });

export const createBookingFn = createServerFn({ method: "POST" })
  .inputValidator((input: { gameId: string; player: Omit<Player, "id"> }) => input)
  .handler(async ({ data }) => {
    const { createBookingRecord } = await import("./db.server");
    const bookingId = await createBookingRecord(data.gameId, data.player);
    return { bookingId };
  });

export const payBookingFn = createServerFn({ method: "POST" })
  .inputValidator((input: { bookingId: string }) => input)
  .handler(async ({ data }) => {
    const { payBookingRecord } = await import("./db.server");
    const ok = await payBookingRecord(data.bookingId);
    return { ok };
  });

export const cancelBookingFn = createServerFn({ method: "POST" })
  .inputValidator((input: { bookingId: string }) => input)
  .handler(async ({ data }) => {
    const { cancelBookingRecord } = await import("./db.server");
    await cancelBookingRecord(data.bookingId);
    return { ok: true };
  });

export const cancelGameFn = createServerFn({ method: "POST" })
  .inputValidator((input: { gameId: string }) => input)
  .handler(async ({ data }) => {
    const { cancelGameRecord } = await import("./db.server");
    await cancelGameRecord(data.gameId);
    return { ok: true };
  });

export const createGameFn = createServerFn({ method: "POST" })
  .inputValidator((input: NewGameInput) => input)
  .handler(async ({ data }) => {
    const { createGameRecord } = await import("./db.server");
    const gameId = await createGameRecord(data);
    return { gameId };
  });
