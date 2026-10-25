import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Pencil } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppHeader, CapacityBar, Page, PaymentChip, StatusBadge } from "@/components/gamelock/ui";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { shortDate, timeRange } from "@/domain/format";
import { formatMoney } from "@/domain/money";
import { cancelGame, useAppState, viewGame } from "@/domain/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/organizer")({
  head: () => ({
    meta: [
      { title: "Organizer dashboard — GameLock" },
      { name: "description", content: "See players, payments and status for your games." },
      { property: "og:title", content: "Organizer dashboard — GameLock" },
      { property: "og:description", content: "Players, payments and game status in one place." },
    ],
  }),
  component: Organizer,
});

function Organizer() {
  const state = useAppState();
  const [gameId, setGameId] = useState(state.games[0].id);
  const [tab, setTab] = useState<"players" | "payments">("players");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const game = state.games.find((g) => g.id === gameId)!;
  const { paid, status } = viewGame(state, game);
  const rows = state.bookings
    .filter((b) => b.gameId === gameId && b.status !== "awaiting_payment")
    .map((b) => ({ b, p: state.payments.find((p) => p.id === b.paymentId)! }));
  const locked = rows.filter((r) => r.b.status === "active" && r.p.status === "successful").reduce((n, r) => n + r.p.amount, 0);

  async function confirmCancel() {
    setBusy(true);
    await cancelGame(gameId);
    setBusy(false);
    setOpen(false);
    toast.success("Game cancelled", { description: "All players are being fully refunded." });
  }

  return (
    <>
      <AppHeader back />
      <Page className="max-w-3xl space-y-5">
        <h1 className="text-3xl font-extrabold">Your games</h1>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {state.games.map((g) => (
            <button key={g.id} onClick={() => setGameId(g.id)} className={cn("shrink-0 rounded-full border px-4 py-2 text-sm font-semibold", g.id === gameId ? "border-secondary bg-secondary text-secondary-foreground" : "bg-card")}>
              {shortDate(g)}
            </button>
          ))}
        </div>

        <div className="rounded-2xl border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-extrabold">{game.title}</h2>
              <div className="text-sm text-muted-foreground">{shortDate(game)} · {timeRange(game)} · {game.venue.name}</div>
            </div>
            <StatusBadge status={status} />
          </div>
          <div className="mt-5 grid grid-cols-3 gap-3">
            <Stat label="Players" value={`${paid} / ${game.maxPlayers}`} />
            <Stat label="Minimum" value={paid >= game.minPlayers ? `${game.minPlayers} reached` : `${paid} / ${game.minPlayers}`} />
            <Stat label="Revenue locked" value={formatMoney(locked, game.currency)} />
          </div>
          <div className="mt-4"><CapacityBar paid={paid} min={game.minPlayers} max={game.maxPlayers} /></div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => toast("Editing games is coming soon")}><Pencil /> Edit game</Button>
            {status !== "cancelled" && <Button variant="outline" className="text-destructive" onClick={() => setOpen(true)}>Cancel game</Button>}
          </div>
        </div>

        <div className="flex gap-1 rounded-xl bg-muted p-1">
          {(["players", "payments"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={cn("flex-1 rounded-lg py-2.5 text-sm font-semibold", tab === t ? "bg-card shadow-sm" : "text-muted-foreground")}>
              {t === "players" ? "View players" : "View payments"}
            </button>
          ))}
        </div>

        <ul className="divide-y rounded-2xl border bg-card">
          {rows.map(({ b, p }) => (
            <li key={b.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
              <div className="min-w-0">
                <div className={cn("font-semibold", b.status === "cancelled" && "text-muted-foreground line-through")}>{b.player.firstName} {b.player.lastName}</div>
                {tab === "payments" && <div className="tabular text-xs text-muted-foreground">{formatMoney(p.amount, p.currency)} · {p.id}</div>}
                {tab === "players" && b.status === "cancelled" && <div className="text-xs text-muted-foreground">Cancelled booking</div>}
              </div>
              <PaymentChip status={p.status} />
            </li>
          ))}
        </ul>
      </Page>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl">Cancel this game?</AlertDialogTitle>
            <AlertDialogDescription>All players will receive a full refund. This can't be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <Button variant="destructive" className="h-12 rounded-xl" onClick={confirmCancel} disabled={busy}>{busy && <Loader2 className="animate-spin" />} Cancel game & refund all</Button>
            <AlertDialogCancel className="h-12 rounded-xl">Keep game</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="tabular mt-0.5 font-display text-lg font-extrabold leading-tight">{value}</div>
    </div>
  );
}
