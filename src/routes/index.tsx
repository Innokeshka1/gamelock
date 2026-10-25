import { createFileRoute, Link } from "@tanstack/react-router";
import { GameCard } from "@/components/gamelock/game-card";
import { AppHeader, Page } from "@/components/gamelock/ui";
import { useStore, viewGame } from "@/domain/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GameLock — Book pickup basketball in Lisbon" },
      { name: "description", content: "Reserve and pay for pickup basketball games in Lisbon. Clear spots, clear status, fair refunds." },
      { property: "og:title", content: "GameLock — Play more. Cancel less." },
      { property: "og:description", content: "Book your spot in recreational sports games in seconds." },
    ],
  }),
  component: Index,
});

function Index() {
  const state = useStore((s) => s);
  const views = state.games.map((g) => viewGame(state, g));
  return (
    <>
      <AppHeader right={<Link to="/organizer" className="text-sm font-semibold text-muted-foreground hover:text-foreground">Organizer</Link>} />
      <Page>
        <h1 className="text-3xl font-extrabold">Upcoming games</h1>
        <p className="mt-1 text-muted-foreground">Play more. Cancel less.</p>
        <div className="mt-6 space-y-4">
          {views.filter((v) => v.status !== "completed").map((v) => <GameCard key={v.game.id} view={v} />)}
        </div>
        {views.some((v) => v.status === "completed") && (
          <section className="mt-6">
            <h2 className="text-3xl font-extrabold">Past Games</h2>
            <div className="mt-6 space-y-4">
              {views.filter((v) => v.status === "completed").map((v) => <GameCard key={v.game.id} view={v} />)}
            </div>
          </section>
        )}
      </Page>
    </>
  );
}
