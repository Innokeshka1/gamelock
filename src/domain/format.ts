import type { Game } from "./types";

const fmt = (game: Game, opts: Intl.DateTimeFormatOptions) => (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: game.venue.timeZone, ...opts }).format(new Date(iso));

export function shortDate(game: Game) {
  const g = (o: Intl.DateTimeFormatOptions) => fmt(game, o)(game.startsAt);
  return `${g({ weekday: "long" })}, ${g({ month: "short" })} ${g({ day: "numeric" })}`;
}

export function longDate(game: Game) {
  const weekday = fmt(game, { weekday: "long" })(game.startsAt);
  const month = fmt(game, { month: "long" })(game.startsAt);
  const day = fmt(game, { day: "numeric" })(game.startsAt);
  return `${weekday}, ${month} ${day}`;
}

export function startTime(game: Game) {
  return fmt(game, { hour: "2-digit", minute: "2-digit", hour12: false })(game.startsAt);
}

export function timeRange(game: Game) {
  return `${startTime(game)}–${fmt(game, { hour: "2-digit", minute: "2-digit", hour12: false })(game.endsAt)}`;
}

export function calendarUrl(game: Game) {
  const z = (iso: string) => iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: game.title,
    dates: `${z(new Date(game.startsAt).toISOString())}/${z(new Date(game.endsAt).toISOString())}`,
    location: `${game.venue.name}, ${game.venue.address}`,
    details: `Bring: ${game.whatToBring.join(", ")}`,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}
