// Server-only database access for GameLock. Maps database rows to domain types
// so the rest of the app never talks to the database directly.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { canBook, canCancelGame, computeGameStatus } from "../game-logic";
import { getBookingPaymentProvider } from "../payments/provider-factory.server";
import { quoteGameCancellation, quotePlayerCancellation } from "../refund";
import type { Booking, Currency, Game, NewGameInput, Payment, Player, Refund } from "../types";

type GameRow = Database["public"]["Tables"]["games"]["Row"];
type PlayerRow = Database["public"]["Tables"]["players"]["Row"];
type BookingRow = Database["public"]["Tables"]["bookings"]["Row"];
type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];
type RefundRow = Database["public"]["Tables"]["refunds"]["Row"];

function createDb() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false },
    // Opaque sb_ keys aren't JWTs; send only apikey, not the default Authorization bearer.
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

const currencyOf = (code: string): Currency => ({ code, minorUnits: 2 });

function toGame(row: GameRow): Game {
  return {
    id: row.id,
    title: row.title,
    sport: { id: row.sport.toLowerCase().replace(/\s+/g, "-"), name: row.sport },
    venue: {
      id: row.venue.toLowerCase().replace(/\s+/g, "-"),
      name: row.venue,
      address: row.venue_address,
      city: row.city,
      country: row.country,
      timeZone: row.time_zone,
      mapsUrl: row.venue_maps_url,
    },
    organizer: { id: "organizer", name: "GameLock" },
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    confirmationDeadline: row.confirmation_deadline,
    currency: currencyOf(row.currency),
    pricePerPlayer: row.price_per_player,
    minPlayers: row.minimum_players,
    maxPlayers: row.maximum_players,
    cancellationPolicy: {
      cutoffHours: row.cancellation_cutoff_hours,
      refundPercentBeforeCutoff: row.refund_percentage,
      refundPercentAfterCutoff: row.refund_percentage_after_cutoff,
      refundPercentOnGameCancelled: row.refund_percentage_on_game_cancelled,
    },
    organizerFeePercent: row.organizer_fee_percentage,
    whatToBring: row.what_to_bring,
    ...(row.cancelled_at ? { cancelledAt: row.cancelled_at } : {}),
    ...(row.cancel_reason === "organizer" || row.cancel_reason === "min_not_reached" ? { cancelReason: row.cancel_reason } : {}),
  };
}

const toPlayer = (row: PlayerRow): Player => ({
  id: row.id,
  firstName: row.first_name,
  lastName: row.last_name,
  email: row.email ?? undefined,
  phone: row.phone ?? undefined,
});

const toPayment = (row: PaymentRow): Payment => ({
  id: row.id,
  bookingId: row.booking_id,
  amount: row.amount,
  currency: currencyOf(row.currency),
  status: row.status,
  ...(row.external_reference ? { providerRef: row.external_reference } : {}),
  createdAt: row.created_at,
});

function toRefund(row: RefundRow, payment: Payment | undefined): Refund {
  return {
    id: row.id,
    paymentId: row.payment_id,
    amount: row.amount,
    fee: payment ? payment.amount - row.amount : 0,
    currency: payment?.currency ?? currencyOf("EUR"),
    status: row.status,
    reason: row.reason === "game_cancelled" ? "game_cancelled" : "player_cancelled",
    createdAt: row.created_at,
  };
}

/** One row of the bookings join query: booking + player + its single payment. */
type BookingJoin = BookingRow & { players: PlayerRow | PlayerRow[] | null; payments: PaymentRow | PaymentRow[] | null };
const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

export interface AppStateData {
  games: Game[];
  bookings: Booking[];
  payments: Payment[];
  refunds: Refund[];
  /** Server time of the fetch — lets the store ignore stale snapshots. */
  fetchedAt: string;
}

export async function fetchState(): Promise<AppStateData> {
  const db = createDb();
  const [gamesRes, bookingsRes, refundsRes] = await Promise.all([
    db.from("games").select("*").order("starts_at"),
    db.from("bookings").select("*, players(*), payments(*)").order("created_at"),
    db.from("refunds").select("*").order("created_at"),
  ]);
  if (gamesRes.error) throw gamesRes.error;
  if (bookingsRes.error) throw bookingsRes.error;
  if (refundsRes.error) throw refundsRes.error;

  const games = gamesRes.data.map(toGame);
  const payments: Payment[] = [];
  const bookings: Booking[] = [];
  for (const row of bookingsRes.data as BookingJoin[]) {
    const player = one(row.players);
    const payment = one(row.payments);
    if (!player || !payment) continue;
    const p = toPayment(payment);
    payments.push(p);
    bookings.push({
      id: row.id,
      gameId: row.game_id,
      player: toPlayer(player),
      spots: row.spots,
      status: row.status,
      paymentId: p.id,
      createdAt: row.created_at,
    });
  }
  const byId = new Map(payments.map((p) => [p.id, p]));
  const refunds = refundsRes.data.map((r) => toRefund(r, byId.get(r.payment_id)));
  // Link each booking to its latest refund, if any.
  for (const b of bookings) {
    const r = refunds.filter((x) => x.paymentId === b.paymentId).at(-1);
    if (r) b.refundId = r.id;
  }
  return { games, bookings, payments, refunds, fetchedAt: new Date().toISOString() };
}

export async function fetchGameMeta(gameId: string): Promise<{ title: string; venue: string; city: string } | null> {
  const db = createDb();
  const { data, error } = await db.from("games").select("title, venue, city").eq("id", gameId).maybeSingle();
  if (error) throw error;
  return data;
}

async function fetchGameRow(db: ReturnType<typeof createDb>, gameId: string): Promise<GameRow> {
  const { data, error } = await db.from("games").select("*").eq("id", gameId).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Game not found");
  return data;
}

// Recheck lifecycle on the server, including requests from stale or direct URLs.
async function currentGameStatus(db: ReturnType<typeof createDb>, game: Game) {
  const { data, error } = await db.from("bookings").select("*, payments(*)").eq("game_id", game.id).eq("status", "confirmed");
  if (error) throw error;
  const paid = (data as BookingJoin[]).reduce((count, row) =>
    count + (one(row.payments)?.status === "successful" ? row.spots : 0), 0);
  return computeGameStatus(game, paid, new Date());
}

export async function createBookingRecord(gameId: string, player: Omit<Player, "id">): Promise<string> {
  const paymentProvider = getBookingPaymentProvider();
  const db = createDb();
  const game = await fetchGameRow(db, gameId);
  if (!canBook(await currentGameStatus(db, toGame(game)))) throw new Error("This game is not bookable.");

  const { data: playerRow, error: playerErr } = await db
    .from("players")
    .insert({ first_name: player.firstName, last_name: player.lastName, email: player.email ?? null, phone: player.phone ?? null })
    .select("id")
    .single();
  if (playerErr) throw playerErr;

  const { data: bookingRow, error: bookingErr } = await db
    .from("bookings")
    .insert({ game_id: gameId, player_id: playerRow.id, status: "pending", spots: 1, amount: game.price_per_player, currency: game.currency })
    .select("id")
    .single();
  if (bookingErr) throw bookingErr;

  const { providerRef } = await paymentProvider.createPayment({
    bookingId: bookingRow.id,
    amount: game.price_per_player,
    currency: currencyOf(game.currency),
  });
  const { error: payErr } = await db
    .from("payments")
    .insert({ booking_id: bookingRow.id, amount: game.price_per_player, currency: game.currency, status: "pending", provider: paymentProvider.id, external_reference: providerRef });
  if (payErr) throw payErr;
  return bookingRow.id;
}

export async function payBookingRecord(bookingId: string): Promise<boolean> {
  const paymentProvider = getBookingPaymentProvider();
  const db = createDb();
  const { data: payment, error } = await db.from("payments").select("*").eq("booking_id", bookingId).maybeSingle();
  if (error) throw error;
  if (!payment?.external_reference) return false;

  const { data: booking, error: bookingError } = await db.from("bookings").select("*").eq("id", bookingId).maybeSingle();
  if (bookingError) throw bookingError;
  if (!booking) throw new Error("Booking not found.");
  const game = toGame(await fetchGameRow(db, booking.game_id));
  const gameStatus = await currentGameStatus(db, game);
  if (!canCancelGame(gameStatus)) throw new Error("This game is no longer active.");
  if (booking.status === "confirmed" && payment.status === "successful") return true;
  if (booking.status !== "pending" || !canBook(gameStatus) ||
      (payment.status !== "pending" && payment.status !== "failed")) {
    throw new Error("This booking cannot be paid.");
  }

  const { status } = await paymentProvider.confirmPayment(payment.external_reference);
  const now = new Date().toISOString();
  const { error: payErr } = await db.from("payments").update({ status, updated_at: now }).eq("id", payment.id);
  if (payErr) throw payErr;
  if (status === "successful") {
    const { error: bookErr } = await db.from("bookings").update({ status: "confirmed" }).eq("id", bookingId);
    if (bookErr) throw bookErr;
  }
  return status === "successful";
}

export async function cancelBookingRecord(bookingId: string): Promise<void> {
  const paymentProvider = getBookingPaymentProvider();
  const db = createDb();
  const { data: booking, error } = await db.from("bookings").select("*, payments(*)").eq("id", bookingId).maybeSingle();
  if (error) throw error;
  const payment = one((booking as BookingJoin | null)?.payments ?? null);
  if (!booking || !payment) return;
  const game = toGame(await fetchGameRow(db, booking.game_id));
  if (!canCancelGame(await currentGameStatus(db, game))) throw new Error("This game is no longer cancellable.");
  if (booking.status !== "pending" && booking.status !== "confirmed") return;
  const now = new Date().toISOString();

  const quote = quotePlayerCancellation(game, payment.amount, new Date());
  if (quote.eligible && payment.status === "successful" && payment.external_reference) {
    const { status } = await paymentProvider.refundPayment(payment.external_reference, quote.refund);
    const { error: refErr } = await db.from("refunds").insert({ payment_id: payment.id, amount: quote.refund, status: "pending", reason: "player_cancelled" });
    if (refErr) throw refErr;
    const { error: payErr } = await db.from("payments").update({ status, updated_at: now }).eq("id", payment.id);
    if (payErr) throw payErr;
  }
  const { error: bookErr } = await db.from("bookings").update({ status: "cancelled", cancelled_at: now }).eq("id", bookingId);
  if (bookErr) throw bookErr;
}

export async function cancelGameRecord(gameId: string): Promise<void> {
  const paymentProvider = getBookingPaymentProvider();
  const db = createDb();
  const game = toGame(await fetchGameRow(db, gameId));
  if (!canCancelGame(await currentGameStatus(db, game))) throw new Error("This game is no longer cancellable.");
  const { data: rows, error } = await db.from("bookings").select("*, payments(*)").eq("game_id", gameId).eq("status", "confirmed");
  if (error) throw error;

  const now = new Date().toISOString();
  for (const row of rows as BookingJoin[]) {
    const payment = one(row.payments);
    if (!payment || payment.status !== "successful") continue;
    const quote = quoteGameCancellation(game, payment.amount);
    if (payment.external_reference) await paymentProvider.refundPayment(payment.external_reference, quote.refund);
    const { error: refErr } = await db.from("refunds").insert({ payment_id: payment.id, amount: quote.refund, status: "pending", reason: "game_cancelled" });
    if (refErr) throw refErr;
    const { error: payErr } = await db.from("payments").update({ status: "refund_pending", updated_at: now }).eq("id", payment.id);
    if (payErr) throw payErr;
  }
  const { error: bookErr } = await db.from("bookings").update({ status: "cancelled", cancelled_at: now }).eq("game_id", gameId).in("status", ["pending", "confirmed"]);
  if (bookErr) throw bookErr;
  const { error: gameErr } = await db.from("games").update({ status: "cancelled", cancelled_at: now, cancel_reason: "organizer", updated_at: now }).eq("id", gameId);
  if (gameErr) throw gameErr;
}

/** Milliseconds offset of a time zone at a given UTC instant (server runs in UTC). */
function tzOffsetMs(utcMs: number, tz: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })
      .formatToParts(new Date(utcMs))
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.parse(`${parts["year"]}-${parts["month"]}-${parts["day"]}T${parts["hour"] === "24" ? "00" : parts["hour"]}:${parts["minute"]}:${parts["second"]}Z`);
  return asUtc - utcMs;
}

/** Interpret a local date+time in a time zone and return the UTC instant. */
function zonedTimeToUtc(date: string, time: string, tz: string): string {
  const guess = Date.parse(`${date}T${time}:00Z`);
  let utc = guess - tzOffsetMs(guess, tz);
  utc = guess - tzOffsetMs(utc, tz); // second pass covers DST boundary cases
  return new Date(utc).toISOString();
}

export async function createGameRecord(input: NewGameInput): Promise<string> {
  const db = createDb();
  const tz = input.timeZone ?? "Europe/Lisbon";
  const id = `${input.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}-${Math.random().toString(36).slice(2, 7)}`;
  const { error } = await db.from("games").insert({
    id,
    title: input.title,
    sport: input.sport,
    country: input.country,
    city: input.city,
    venue: input.venue,
    venue_address: input.venueAddress ?? "",
    venue_maps_url: input.venueMapsUrl ?? "",
    time_zone: tz,
    date: input.date,
    start_time: input.startTime,
    end_time: input.endTime,
    starts_at: zonedTimeToUtc(input.date, input.startTime, tz),
    ends_at: zonedTimeToUtc(input.date, input.endTime, tz),
    currency: input.currency,
    price_per_player: input.pricePerPlayer,
    minimum_players: input.minPlayers,
    maximum_players: input.maxPlayers,
    confirmation_deadline: input.confirmationDeadline,
    cancellation_cutoff_hours: input.cancellationCutoffHours,
    refund_percentage: input.refundPercentage,
    what_to_bring: input.whatToBring ?? [],
    status: "pending",
  });
  if (error) throw error;
  return id;
}
