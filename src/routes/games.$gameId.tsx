import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Calendar, Clock, MapPin, Navigation, Users, Wallet } from "lucide-react";
import { toast } from "sonner";
import { ActionBar, AppHeader, CapacityBar, InfoRow, Page, Section, StatusBadge } from "@/components/gamelock/ui";
import { Button } from "@/components/ui/button";
import { getGameMeta } from "@/domain/data/api";
import { longDate, timeRange } from "@/domain/format";
import { canBook, spotsLeft } from "@/domain/game-logic";
import { formatMoney } from "@/domain/money";
import { useAppState, viewGame } from "@/domain/store";
import { statusMessage } from "@/domain/status-message";

export const Route = createFileRoute("/games/$gameId")({
  loader: async ({ params }) => {
    const meta = await getGameMeta({ data: { gameId: params.gameId } });
    if (!meta) throw notFound();
    return meta;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `${loaderData.title} · ${loaderData.venue} — GameLock` : "Game — GameLock" },
      { name: "description", content: loaderData ? `Reserve your spot at ${loaderData.title}, ${loaderData.venue}, ${loaderData.city}.` : "Game details" },
      { property: "og:title", content: loaderData?.title ?? "GameLock game" },
      { property: "og:description", content: "Spots, price, status and cancellation policy at a glance." },
    ],
  }),
  component: GameDetails,
});

function GameDetails() {
  const { gameId } = Route.useParams();
  const state = useAppState();
  const game = state.games.find((g) => g.id === gameId)!;
  const { paid, status } = viewGame(state, game);
  const left = spotsLeft(game, paid);
  const p = game.cancellationPolicy;

  return (
    <>
      <AppHeader back />
      <Page className="space-y-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-primary">{game.sport.name} · {game.venue.city}</div>
          <h1 className="mt-1 text-3xl font-extrabold">{game.title}</h1>
          <div className="mt-3"><StatusBadge status={status} /></div>
          <p className="mt-2 text-sm text-muted-foreground">{statusMessage(game, status)}</p>
        </div>

        <Section title="Spots">
          <div className="mb-3 flex items-end justify-between">
            <div><span className="tabular font-display text-3xl font-extrabold">{paid}</span><span className="text-muted-foreground"> / {game.maxPlayers} booked</span></div>
            {status !== "cancelled" && <div className="text-sm font-semibold">{left} left</div>}
          </div>
          <CapacityBar paid={paid} min={game.minPlayers} max={game.maxPlayers} />
          <div className="mt-2 flex justify-between text-xs text-muted-foreground">
            <span>Minimum {game.minPlayers} {paid >= game.minPlayers ? "✓ reached" : `· ${game.minPlayers - paid} more needed`}</span>
            <span>Max {game.maxPlayers}</span>
          </div>
        </Section>

        <Section title="Details">
          <InfoRow icon={<Calendar />} label="Date" value={longDate(game)} />
          <InfoRow icon={<Clock />} label="Time" value={timeRange(game)} />
          <InfoRow icon={<MapPin />} label="Venue" value={<>{game.venue.name}<div className="text-sm font-normal text-muted-foreground">{game.venue.address}</div></>} />
          <InfoRow icon={<Wallet />} label="Price" value={`${formatMoney(game.pricePerPlayer, game.currency)} per player`} />
          <InfoRow icon={<Users />} label="Players" value={`${game.minPlayers} minimum · ${game.maxPlayers} maximum`} />
          <Button variant="outline" className="mt-2 w-full" asChild>
            <a href={game.venue.mapsUrl} target="_blank" rel="noreferrer"><Navigation /> Get directions</a>
          </Button>
        </Section>

        <Section title="Cancellation policy">
          <ul className="space-y-2.5 text-sm">
            <li className="flex justify-between gap-4"><span>More than {p.cutoffHours}h before the game</span><b>{p.refundPercentBeforeCutoff}% refund</b></li>
            <li className="flex justify-between gap-4"><span>Less than {p.cutoffHours}h before the game</span><b>{p.refundPercentAfterCutoff === 0 ? "No refund" : `${p.refundPercentAfterCutoff}% refund`}</b></li>
            <li className="flex justify-between gap-4"><span>Game cancelled or minimum not reached</span><b>{p.refundPercentOnGameCancelled}% refund</b></li>
          </ul>
        </Section>

        <Section title="What to bring">
          <ul className="space-y-1.5 text-sm">{game.whatToBring.map((i) => <li key={i}>• {i}</li>)}</ul>
        </Section>
      </Page>

      <ActionBar>
        {canBook(status) ? (
          <Button size="xl" asChild>
            <Link to="/book/$gameId" params={{ gameId }}>Reserve my spot · {formatMoney(game.pricePerPlayer, game.currency)}</Link>
          </Button>
        ) : status === "sold_out" ? (
          <Button size="xl" variant="outline" onClick={() => toast("Waitlist is coming soon", { description: "We'll let you know when it's available." })}>Join waitlist</Button>
        ) : (
          <Button size="xl" variant="outline" asChild><Link to="/">Browse other games</Link></Button>
        )}
      </ActionBar>
    </>
  );
}
