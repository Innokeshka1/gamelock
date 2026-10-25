import { percentOf } from "./money";
import { hoursUntilStart } from "./game-logic";
import type { Game } from "./types";

export interface RefundQuote {
  eligible: boolean;
  refundPercent: number;
  refund: number;
  fee: number;
  original: number;
}

/** Refund a player gets for cancelling their own booking right now. */
export function quotePlayerCancellation(game: Game, paidAmount: number, now: Date): RefundQuote {
  const p = game.cancellationPolicy;
  const beforeCutoff = hoursUntilStart(game, now) > p.cutoffHours;
  const refundPercent = beforeCutoff ? p.refundPercentBeforeCutoff : p.refundPercentAfterCutoff;
  const refund = percentOf(paidAmount, refundPercent);
  return {
    eligible: refund > 0,
    refundPercent,
    refund,
    fee: paidAmount - refund,
    original: paidAmount,
  };
}

export function quoteGameCancellation(game: Game, paidAmount: number): RefundQuote {
  const refundPercent = game.cancellationPolicy.refundPercentOnGameCancelled;
  const refund = percentOf(paidAmount, refundPercent);
  return { eligible: refund > 0, refundPercent, refund, fee: paidAmount - refund, original: paidAmount };
}

export function policySummary(game: Game): string {
  const p = game.cancellationPolicy;
  return `Cancel more than ${p.cutoffHours} hours before the game and receive an ${p.refundPercentBeforeCutoff}% refund. If the game is cancelled, you receive a full refund.`;
}
