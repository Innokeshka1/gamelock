import { Link } from "@tanstack/react-router";
import { Calendar, MapPin } from "lucide-react";
import { spotsLeft } from "@/domain/game-logic";
import { formatMoney } from "@/domain/money";
import { shortDate, timeRange } from "@/domain/format";
import type { GameView } from "@/domain/store";
import { Button } from "@/components/ui/button";
import { CapacityBar, StatusBadge } from "./ui";

export function GameCard({ view }: { view: GameView }) {
  const { game, paid, status } = view;
  const left = spotsLeft(game, paid);
  return (
    <article className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-primary">{game.sport.name}</div>
          <h2 className="mt-1 text-xl font-extrabold">{game.title}</h2>
        </div>
        <div className="text-right">
          <div className="font-display text-2xl font-extrabold">{formatMoney(game.pricePerPlayer, game.currency)}</div>
          <div className="text-xs text-muted-foreground">per player</div>
        </div>
      </div>
      <div className="mt-3 space-y-1.5 text-sm">
        <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground" />{shortDate(game)} · {timeRange(game)}</div>
        <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" />{game.venue.name}, {game.venue.city}</div>
      </div>
      <div className="mt-4"><StatusBadge status={status} /></div>
      <div className="mt-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="tabular font-semibold">
            {status === "pending" ? `${paid} / ${game.minPlayers} minimum players` : `${paid} / ${game.maxPlayers} spots booked`}
          </span>
          {status !== "cancelled" && <span className="text-muted-foreground">{left === 0 ? "Full" : `${left} spots left`}</span>}
        </div>
        <CapacityBar paid={paid} min={game.minPlayers} max={game.maxPlayers} />
      </div>
      <div className="mt-5">
        {status === "sold_out" ? (
          <Button variant="outline" size="xl" asChild><Link to="/games/$gameId" params={{ gameId: game.id }}>Join waitlist</Link></Button>
        ) : status === "cancelled" ? (
          <Button variant="outline" size="xl" asChild><Link to="/games/$gameId" params={{ gameId: game.id }}>View details</Link></Button>
        ) : (
          <Button size="xl" asChild><Link to="/games/$gameId" params={{ gameId: game.id }}>Join game</Link></Button>
        )}
      </div>
    </article>
  );
}
