import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Pencil, Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AppHeader, CapacityBar, Page, PaymentChip, StatusBadge } from "@/components/gamelock/ui";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { shortDate, timeRange } from "@/domain/format";
import { canCancelGame } from "@/domain/game-logic";
import { formatMoney } from "@/domain/money";
import { cancelGame, createGame, prepareNativeRefund, signNativeRefund, useAppState, viewGame } from "@/domain/store";
import type { NewGameInput } from "@/domain/types";
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

const emptyForm = {
  title: "",
  sport: "Basketball",
  country: "PT",
  city: "Lisbon",
  venue: "",
  date: "",
  startTime: "20:00",
  endTime: "22:00",
  currency: "EUR",
  price: "7",
  minPlayers: "10",
  maxPlayers: "15",
  confirmationDeadline: "",
  cancellationCutoffHours: "4",
  refundPercentage: "80",
};

function Organizer() {
  const state = useAppState();
  const [gameId, setGameId] = useState(state.games[0]?.id ?? "");
  const [tab, setTab] = useState<"players" | "payments">("players");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [refundBusy, setRefundBusy] = useState(false);
  const [refundReview, setRefundReview] = useState<(Extract<Awaited<ReturnType<typeof prepareNativeRefund>>, { status: "awaiting_signature" }> & { bookingId: string }) | null>(null);

  async function reviewRefund(bookingId: string) {
    if (refundBusy) return;
    setRefundBusy(true);
    try {
      const result = await prepareNativeRefund(bookingId);
      if (result.status === "awaiting_signature") setRefundReview({ ...result, bookingId });
      else toast.success(result.status === "verified" ? "EURC refund verified" : "No refund is due");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not prepare refund."); }
    finally { setRefundBusy(false); }
  }

  async function signRefund() {
    if (!refundReview || refundBusy) return;
    setRefundBusy(true);
    try {
      await signNativeRefund(refundReview.bookingId, refundReview.xdr, refundReview.organizer);
      setRefundReview(null);
      toast.success("EURC refund verified on Testnet");
    } catch (error) {
      setRefundReview(null);
      toast.error(error instanceof Error ? error.message : "Check this refund again before retrying.");
    } finally { setRefundBusy(false); }
  }
  const game = state.games.find((g) => g.id === gameId) ?? state.games[0];
  const view = game ? viewGame(state, game) : null;
  const rows = state.bookings
    .filter((b) => b.gameId === game?.id && b.status !== "pending")
    .map((b) => ({ b, p: state.payments.find((p) => p.id === b.paymentId)! }));
  const locked = rows.filter((r) => r.b.status === "confirmed" && r.p.status === "successful").reduce((n, r) => n + r.p.amount, 0);

  async function confirmCancel() {
    if (!game || !view || busy || !canCancelGame(view.status) && game.cancelReason !== "organizer") return;
    setBusy(true);
    try {
      await cancelGame(game.id);
      setOpen(false);
      toast.success("Game cancelled", { description: "Refunds recorded. Sign pending native EURC refunds individually below." });
    } catch {
      toast.error("Could not cancel the game. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function publish(e: FormEvent) {
    e.preventDefault();
    if (createBusy) return;
    const pricePerPlayer = Math.round(Number.parseFloat(form.price) * 100);
    if (!form.title.trim() || !form.venue.trim() || !form.date || !form.confirmationDeadline || !(pricePerPlayer > 0)) {
      toast.error("Fill in title, venue, date, deadline and price.");
      return;
    }
    const input: NewGameInput = {
      title: form.title.trim(),
      sport: form.sport.trim() || "Basketball",
      country: form.country.trim() || "PT",
      city: form.city.trim(),
      venue: form.venue.trim(),
      date: form.date,
      startTime: form.startTime,
      endTime: form.endTime,
      currency: form.currency.trim().toUpperCase() || "EUR",
      pricePerPlayer,
      minPlayers: Number.parseInt(form.minPlayers, 10) || 1,
      maxPlayers: Number.parseInt(form.maxPlayers, 10) || 1,
      confirmationDeadline: new Date(form.confirmationDeadline).toISOString(),
      cancellationCutoffHours: Number.parseInt(form.cancellationCutoffHours, 10) || 0,
      refundPercentage: Number.parseInt(form.refundPercentage, 10) || 0,
    };
    setCreateBusy(true);
    try {
      const id = await createGame(input);
      setCreateOpen(false);
      setForm(emptyForm);
      setGameId(id);
      toast.success("Game published", { description: "It's live and bookable now." });
    } catch {
      toast.error("Could not publish the game. Please try again.");
    } finally {
      setCreateBusy(false);
    }
  }

  const field = (key: keyof typeof emptyForm, label: string, opts: { type?: string; step?: string; min?: string } = {}) => (
    <div className="space-y-1.5">
      <Label htmlFor={`cg-${key}`} className="text-sm font-semibold">{label}</Label>
      <Input
        id={`cg-${key}`}
        type={opts.type ?? "text"}
        step={opts.step}
        min={opts.min}
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        className="h-11 rounded-xl bg-card text-base"
      />
    </div>
  );

  return (
    <>
      <AppHeader back />
      <Page className="max-w-3xl space-y-5">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-3xl font-extrabold">Your games</h1>
          <Button onClick={() => setCreateOpen(true)}><Plus /> New game</Button>
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {state.games.map((g) => (
            <button key={g.id} onClick={() => setGameId(g.id)} className={cn("shrink-0 rounded-full border px-4 py-2 text-sm font-semibold", g.id === game?.id ? "border-secondary bg-secondary text-secondary-foreground" : "bg-card")}>
              {shortDate(g)}
            </button>
          ))}
        </div>

        {game && view && (
          <>
            <div className="rounded-2xl border bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-extrabold">{game.title}</h2>
                  <div className="text-sm text-muted-foreground">{shortDate(game)} · {timeRange(game)} · {game.venue.name}</div>
                </div>
                <StatusBadge status={view.status} />
              </div>
              <div className="mt-5 grid grid-cols-3 gap-3">
                <Stat label="Players" value={`${view.paid} / ${game.maxPlayers}`} />
                <Stat label="Minimum" value={view.paid >= game.minPlayers ? `${game.minPlayers} reached` : `${view.paid} / ${game.minPlayers}`} />
                <Stat label="Revenue locked" value={formatMoney(locked, game.currency)} />
              </div>
              <div className="mt-4"><CapacityBar paid={view.paid} min={game.minPlayers} max={game.maxPlayers} /></div>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button variant="outline" disabled={!canCancelGame(view.status)} onClick={() => toast("Editing games is coming soon")}><Pencil /> Edit game</Button>
                {(canCancelGame(view.status) || game.cancelReason === "organizer") && <Button variant="outline" className="text-destructive" onClick={() => setOpen(true)}>{game.cancelReason === "organizer" ? "Resume cancellation" : "Cancel game"}</Button>}
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
                  <div className="space-y-2 text-right">
                    <PaymentChip status={p.status} />
                    {p.provider === "stellar-native" && (p.status === "refund_pending" || (p.status === "refunded" && b.status !== "refunded")) && (
                      <Button variant="outline" disabled={refundBusy} onClick={() => reviewRefund(b.id)}>Review EURC refund</Button>
                    )}
                    {p.refundTransactionHash && <a className="block text-sm text-primary underline" href={`https://stellar.expert/explorer/testnet/tx/${p.refundTransactionHash}`} target="_blank" rel="noreferrer">Verified refund</a>}
                  </div>
                </li>
              ))}
              {rows.length === 0 && <li className="px-5 py-6 text-center text-sm text-muted-foreground">No bookings yet.</li>}
            </ul>
          </>
        )}
      </Page>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl">Cancel this game?</AlertDialogTitle>
            <AlertDialogDescription>Confirmed bookings will receive full refunds. Native EURC refunds require a separate Organizer signature for each booking. This can't be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <Button variant="destructive" className="h-12 rounded-xl" onClick={confirmCancel} disabled={busy || !view || (!canCancelGame(view.status) && game?.cancelReason !== "organizer")}>{busy && <Loader2 className="animate-spin" />} Cancel game & refund all</Button>
            <AlertDialogCancel className="h-12 rounded-xl">Keep game</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={Boolean(refundReview)} onOpenChange={(open) => { if (!open && !refundBusy) setRefundReview(null); }}>
        <DialogContent className="rounded-2xl">
          <DialogHeader><DialogTitle>Review EURC refund</DialogTitle></DialogHeader>
          {refundReview && <div className="space-y-3 break-all text-sm">
            <p>Refund: <strong>{refundReview.amount} EURC</strong> · Stellar Testnet</p>
            <p>EURC issuer: {refundReview.issuer}</p>
            <p>Booking: {refundReview.bookingId}</p>
            <p>Original payment: {refundReview.paymentHash}</p>
            <p>From Organizer: {refundReview.organizer}</p>
            <p>To original payer: {refundReview.payer}</p>
            <p>Sign within five minutes. Process one refund at a time. If interrupted, review this same refund again to check its saved hash.</p>
            <Button disabled={refundBusy} onClick={signRefund}>Sign refund with Freighter</Button>
          </div>}
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl">Create game</DialogTitle>
          </DialogHeader>
          <form onSubmit={publish} className="space-y-4">
            {field("title", "Title")}
            <div className="grid grid-cols-2 gap-3">
              {field("sport", "Sport")}
              {field("venue", "Venue")}
              {field("city", "City")}
              {field("country", "Country")}
              {field("date", "Date", { type: "date" })}
              {field("confirmationDeadline", "Confirmation deadline", { type: "datetime-local" })}
              {field("startTime", "Start time", { type: "time" })}
              {field("endTime", "End time", { type: "time" })}
              {field("currency", "Currency")}
              {field("price", "Price per player", { type: "number", step: "0.01", min: "0" })}
              {field("minPlayers", "Minimum players", { type: "number", min: "1" })}
              {field("maxPlayers", "Maximum players", { type: "number", min: "1" })}
              {field("cancellationCutoffHours", "Cancellation cutoff (hours)", { type: "number", min: "0" })}
              {field("refundPercentage", "Refund % before cutoff", { type: "number", min: "0" })}
            </div>
            <Button type="submit" size="xl" className="w-full" disabled={createBusy}>
              {createBusy && <Loader2 className="animate-spin" />} Publish game
            </Button>
          </form>
        </DialogContent>
      </Dialog>
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
