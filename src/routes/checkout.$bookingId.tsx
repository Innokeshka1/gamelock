import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2, Lock, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { ActionBar, AppHeader, Page } from "@/components/gamelock/ui";
import { Button } from "@/components/ui/button";
import { shortDate, startTime } from "@/domain/format";
import { formatMoney, formatMoneyExact } from "@/domain/money";
import { policySummary } from "@/domain/refund";
import { payBooking, useAppState } from "@/domain/store";

export const Route = createFileRoute("/checkout/$bookingId")({
  head: () => ({
    meta: [
      { title: "Checkout — GameLock" },
      { name: "description", content: "Pay securely to lock in your spot." },
      { property: "og:title", content: "Checkout — GameLock" },
      { property: "og:description", content: "Pay securely to lock in your spot." },
    ],
  }),
  component: Checkout,
});

function Checkout() {
  const { bookingId } = Route.useParams();
  const navigate = useNavigate();
  const state = useAppState();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const booking = state.bookings.find((b) => b.id === bookingId);
  const game = state.games.find((g) => g.id === booking?.gameId);
  const payment = state.payments.find((p) => p.id === booking?.paymentId);

  if (!booking || !game || !payment) {
    return (
      <>
        <AppHeader back />
        <Page><p className="text-muted-foreground">This booking has expired.</p><Button className="mt-4" asChild><Link to="/">See games</Link></Button></Page>
      </>
    );
  }

  async function pay() {
    setBusy(true);
    setFailed(false);
    const ok = await payBooking(bookingId);
    setBusy(false);
    if (ok) navigate({ to: "/bookings/$bookingId", params: { bookingId }, replace: true });
    else setFailed(true);
  }

  return (
    <>
      <AppHeader back />
      <Page className="space-y-5">
        <h1 className="text-3xl font-extrabold">Checkout</h1>
        <div className="rounded-2xl border bg-card p-5">
          <div className="text-xs font-bold uppercase tracking-wider text-primary">{game.sport.name}</div>
          <div className="mt-1 text-lg font-extrabold">{game.title}</div>
          <div className="mt-1 text-sm text-muted-foreground">{shortDate(game)} · {startTime(game)} · {game.venue.name}</div>
          <div className="my-4 border-t" />
          <div className="flex justify-between text-sm"><span>1 player · {booking.player.firstName} {booking.player.lastName}</span><span className="tabular">{formatMoneyExact(payment.amount, payment.currency)}</span></div>
          <div className="mt-3 flex justify-between text-lg font-extrabold"><span>Total</span><span className="tabular">{formatMoneyExact(payment.amount, payment.currency)}</span></div>
        </div>

        <div className="flex gap-3 rounded-2xl bg-muted p-4 text-sm">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-success" />
          <p>{policySummary(game)}</p>
        </div>

        {failed && <p className="rounded-xl bg-danger-soft p-4 text-sm font-semibold text-destructive">Payment didn't go through. You haven't been charged — please try again.</p>}
      </Page>
      <ActionBar>
        <Button size="xl" onClick={pay} disabled={busy}>
          {busy ? <><Loader2 className="animate-spin" /> Processing…</> : <><Lock /> Pay {formatMoney(payment.amount, payment.currency)}</>}
        </Button>
        <p className="text-center text-xs text-muted-foreground">Demo checkout — no real payment is taken.</p>
      </ActionBar>
    </>
  );
}
