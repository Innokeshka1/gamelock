import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarPlus, Check, Loader2, Navigation, XCircle } from "lucide-react";
import { useState } from "react";
import { AppHeader, Page, Section, StatusBadge, statusLabel } from "@/components/gamelock/ui";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { calendarUrl, longDate, timeRange } from "@/domain/format";
import { formatMoney, formatMoneyExact } from "@/domain/money";
import { quotePlayerCancellation } from "@/domain/refund";
import { cancelBooking, useAppState, viewGame } from "@/domain/store";

export const Route = createFileRoute("/bookings/$bookingId")({
  head: () => ({
    meta: [
      { title: "Your booking — GameLock" },
      { name: "description", content: "Your spot, payment and game status." },
      { property: "og:title", content: "Your booking — GameLock" },
      { property: "og:description", content: "Your spot, payment and game status." },
    ],
  }),
  component: BookingPage,
});

function BookingPage() {
  const { bookingId } = Route.useParams();
  const state = useAppState();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const booking = state.bookings.find((b) => b.id === bookingId);
  const game = state.games.find((g) => g.id === booking?.gameId);
  const payment = state.payments.find((p) => p.id === booking?.paymentId);
  if (!booking || !game || !payment) {
    return <><AppHeader back /><Page><p className="text-muted-foreground">Booking not found.</p><Button className="mt-4" asChild><Link to="/">See games</Link></Button></Page></>;
  }
  const { paid, status } = viewGame(state, game);
  const refund = state.refunds.find((r) => r.id === booking.refundId);
  const gameRefund = state.refunds.find((r) => r.paymentId === payment.id && r.reason === "game_cancelled");
  const quote = quotePlayerCancellation(game, payment.amount, new Date());
  const p = game.cancellationPolicy;
  const cancelled = booking.status === "cancelled";

  async function confirmCancel() {
    setBusy(true);
    await cancelBooking(bookingId);
    setBusy(false);
    setOpen(false);
    window.scrollTo({ top: 0 });
  }

  return (
    <>
      <AppHeader />
      <Page className="space-y-4">
        {cancelled ? (
          <div className="py-6 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-muted"><XCircle className="h-10 w-10 text-muted-foreground" /></div>
            <h1 className="mt-5 text-3xl font-extrabold">Booking cancelled</h1>
            <p className="mt-2 font-semibold">
              {refund ? `${formatMoneyExact(refund.amount, refund.currency)} refund initiated` : "No refund — cancelled within the non-refundable window"}
            </p>
            {refund && <p className="mt-1 text-sm text-muted-foreground">It usually arrives within 5–10 business days.</p>}
          </div>
        ) : status === "cancelled" ? (
          <div className="py-6 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-danger-soft"><XCircle className="h-10 w-10 text-destructive" /></div>
            <h1 className="mt-5 text-3xl font-extrabold">Game cancelled</h1>
            <p className="mt-2 text-muted-foreground">Your payment will be fully refunded.</p>
            {gameRefund && <p className="mt-1 font-semibold">{formatMoneyExact(gameRefund.amount, gameRefund.currency)} refund initiated</p>}
          </div>
        ) : (
          <div className="py-6 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-success text-success-foreground"><Check className="h-11 w-11" strokeWidth={3} /></div>
            <h1 className="mt-5 text-4xl font-extrabold">You're in!</h1>
            <p className="mt-1 text-lg text-muted-foreground">Your spot is {status === "pending" ? "reserved" : "confirmed"}.</p>
          </div>
        )}

        <div className="rounded-2xl border bg-card p-5">
          <div className="text-lg font-extrabold">{game.title}</div>
          <div className="mt-2 space-y-0.5 text-sm">
            <div>{longDate(game)}</div>
            <div>{timeRange(game)}</div>
            <div>{game.venue.name}, {game.venue.city}</div>
          </div>
          <div className="my-4 border-t" />
          <dl className="grid grid-cols-2 gap-y-3 text-sm">
            <dt className="text-muted-foreground">Player</dt><dd className="text-right font-semibold">{booking.player.firstName} {booking.player.lastName}</dd>
            <dt className="text-muted-foreground">Payment</dt><dd className="text-right font-semibold">{formatMoney(payment.amount, payment.currency)} paid</dd>
            <dt className="text-muted-foreground">Game status</dt><dd className="text-right"><StatusBadge status={status} /></dd>
            <dt className="text-muted-foreground">Spots</dt><dd className="tabular text-right font-semibold">{paid} / {game.maxPlayers} booked</dd>
          </dl>
          {status === "pending" && !cancelled && (
            <p className="mt-4 rounded-xl bg-warning-soft p-3 text-sm text-warning">{statusLabel.pending}: needs {game.minPlayers - paid} more player{game.minPlayers - paid === 1 ? "" : "s"}. If it doesn't happen, you get a full refund.</p>
          )}
        </div>

        {!cancelled && status !== "cancelled" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" className="h-12 rounded-xl" asChild><a href={calendarUrl(game)} target="_blank" rel="noreferrer"><CalendarPlus /> Add to calendar</a></Button>
              <Button variant="outline" className="h-12 rounded-xl" asChild><a href={game.venue.mapsUrl} target="_blank" rel="noreferrer"><Navigation /> Get directions</a></Button>
            </div>
            <Section title="What to bring">
              <ul className="space-y-1.5 text-sm">{game.whatToBring.map((i) => <li key={i}>• {i}</li>)}</ul>
            </Section>
            <button onClick={() => setOpen(true)} className="w-full py-3 text-sm font-semibold text-muted-foreground underline underline-offset-4 hover:text-destructive">Cancel booking</button>
          </>
        )}

        {(cancelled || status === "cancelled") && <Button size="xl" asChild><Link to="/">Find another game</Link></Button>}
      </Page>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl">{quote.eligible ? "Cancel your spot?" : "This booking is no longer refundable."}</AlertDialogTitle>
            <AlertDialogDescription>
              {quote.eligible
                ? `You're cancelling more than ${p.cutoffHours} hours before the game, so you get ${quote.refundPercent}% back.`
                : `Cancellations made less than ${p.cutoffHours} hours before the game are not eligible for a refund.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <dl className="grid grid-cols-2 gap-y-2 rounded-xl bg-muted p-4 text-sm">
            <dt>Original payment</dt><dd className="tabular text-right">{formatMoneyExact(quote.original, payment.currency)}</dd>
            <dt>Cancellation fee</dt><dd className="tabular text-right">−{formatMoneyExact(quote.fee, payment.currency)}</dd>
            <dt className="font-bold">Refund</dt><dd className="tabular text-right font-bold">{formatMoneyExact(quote.refund, payment.currency)}</dd>
          </dl>
          <AlertDialogFooter className="gap-2">
            <Button variant="destructive" className="h-12 rounded-xl" onClick={confirmCancel} disabled={busy}>
              {busy && <Loader2 className="animate-spin" />} Confirm cancellation
            </Button>
            <AlertDialogCancel className="h-12 rounded-xl">Keep my spot</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
