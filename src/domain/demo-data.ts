import type { Booking, CancellationPolicy, Currency, Game, Organizer, Payment, Sport, Venue } from "./types";

export const EUR: Currency = { code: "EUR", minorUnits: 2 };
const basketball: Sport = { id: "basketball", name: "Basketball" };
const organizer: Organizer = { id: "org_1", name: "Lisbon Hoops" };
const standardPolicy: CancellationPolicy = {
  cutoffHours: 4,
  refundPercentBeforeCutoff: 80,
  refundPercentAfterCutoff: 0,
  refundPercentOnGameCancelled: 100,
};
const inatel: Venue = {
  id: "inatel",
  name: "INATEL",
  address: "Av. Rio de Janeiro, 1700-330 Lisboa",
  city: "Lisbon",
  country: "PT",
  timeZone: "Europe/Lisbon",
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=INATEL+Lisboa+Parque+de+Jogos",
};
const alvalade: Venue = {
  ...inatel,
  id: "alvalade",
  name: "Pavilhão Alvalade",
  address: "R. Alferes Malheiro, 1700-024 Lisboa",
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=Alvalade+Lisboa+pavilhao",
};

const bring = ["Water", "Reversible light/dark jersey", "Basketball optional"];
const base = {
  sport: basketball,
  organizer,
  currency: EUR,
  pricePerPlayer: 700,
  minPlayers: 10,
  maxPlayers: 15,
  cancellationPolicy: standardPolicy,
  organizerFeePercent: 0,
  whatToBring: bring,
};

export const demoGames: Game[] = [
  {
    ...base,
    id: "pickup-lisbon-thu",
    title: "Pickup Basketball Lisbon",
    venue: inatel,
    startsAt: "2026-10-29T20:00:00Z",
    endsAt: "2026-10-29T22:00:00Z",
    confirmationDeadline: "2026-10-29T12:00:00Z",
  },
  {
    ...base,
    id: "pickup-lisbon-fri",
    title: "Friday Pickup Basketball",
    venue: alvalade,
    startsAt: "2026-10-30T19:00:00Z",
    endsAt: "2026-10-30T21:00:00Z",
    confirmationDeadline: "2026-10-30T11:00:00Z",
  },
  {
    ...base,
    id: "sunday-lisbon",
    title: "Sunday Basketball Lisbon",
    venue: inatel,
    startsAt: "2026-11-01T10:00:00Z",
    endsAt: "2026-11-01T12:00:00Z",
    confirmationDeadline: "2026-10-31T20:00:00Z",
  },
];

const names = [
  "Alex Martin", "Marco Silva", "Tiago Costa", "Inês Rocha", "Diogo Pereira", "Lucas Moreau",
  "Rafael Gomes", "Ben Carter", "João Santos", "Miguel Alves", "Pedro Nunes", "Sam Okafor",
  "Hugo Ferreira", "Ana Ribeiro", "Daniel Kim",
];

export function seedBookings(): { bookings: Booking[]; payments: Payment[] } {
  const counts: Record<string, number> = { "pickup-lisbon-thu": 12, "pickup-lisbon-fri": 15, "sunday-lisbon": 7 };
  const bookings: Booking[] = [];
  const payments: Payment[] = [];
  for (const game of demoGames) {
    for (let i = 0; i < counts[game.id]; i++) {
      const [firstName, lastName] = names[i].split(" ");
      const id = `bk_${game.id}_${i}`;
      const paymentId = `pay_${game.id}_${i}`;
      const createdAt = "2026-10-20T10:00:00Z";
      bookings.push({ id, gameId: game.id, player: { id: `pl_${i}`, firstName, lastName }, spots: 1, status: "active", paymentId, createdAt });
      payments.push({ id: paymentId, bookingId: id, amount: game.pricePerPlayer, currency: game.currency, status: "successful", providerRef: `seed_${id}`, createdAt });
    }
  }
  return { bookings, payments };
}
