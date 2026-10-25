import type { Game, GameStatus } from "./types";

export function statusMessage(game: Game, status: GameStatus) {
  switch (status) {
    case "pending":
      return `This game will be confirmed once ${game.minPlayers} players have booked and paid.`;
    case "confirmed":
      return `Minimum of ${game.minPlayers} players reached. This game is happening.`;
    case "sold_out":
      return "All spots are taken. Join the waitlist to hear if one opens up.";
    case "cancelled":
      return game.cancelReason === "organizer"
        ? "The organizer cancelled this game. All payments will be fully refunded."
        : "The minimum number of players was not reached. Your payment will be fully refunded.";
  }
}

