import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { ActionBar, AppHeader, Page } from "@/components/gamelock/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { shortDate, startTime } from "@/domain/format";
import { formatMoney } from "@/domain/money";
import { toast } from "sonner";
import { canBook } from "@/domain/game-logic";
import { createBooking, useAppState, viewGame } from "@/domain/store";

export const Route = createFileRoute("/book/$gameId")({
  head: () => ({
    meta: [
      { title: "Your details — GameLock" },
      { name: "description", content: "Tell us who's playing. No account needed." },
      { property: "og:title", content: "Book your spot — GameLock" },
      { property: "og:description", content: "No account needed. Just your name." },
    ],
  }),
  component: PlayerDetails,
});

function PlayerDetails() {
  const { gameId } = Route.useParams();
  const navigate = useNavigate();
  const state = useAppState();
  const game = state.games.find((g) => g.id === gameId);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "" });
  const [busy, setBusy] = useState(false);
  if (!game) return null;
  const bookable = canBook(viewGame(state, game).status);
  const valid = form.firstName.trim() && form.lastName.trim();

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!valid || busy || !bookable) return;
    setBusy(true);
    try {
      const bookingId = await createBooking(gameId, {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
      });
      await navigate({ to: "/checkout/$bookingId", params: { bookingId } });
    } catch {
      toast.error("Could not create your booking. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const field = (key: keyof typeof form, label: string, opts: { optional?: boolean; type?: string; auto?: string }) => (
    <div className="space-y-1.5">
      <Label htmlFor={key} className="text-sm font-semibold">
        {label} {opts.optional && <span className="font-normal text-muted-foreground">— optional</span>}
      </Label>
      <Input id={key} type={opts.type ?? "text"} autoComplete={opts.auto} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className="h-12 rounded-xl bg-card text-base" required={!opts.optional} />
    </div>
  );

  return (
    <form onSubmit={submit}>
      <AppHeader back />
      <Page className="space-y-6">
        <div>
          <h1 className="text-3xl font-extrabold">Who's playing?</h1>
          <p className="mt-1 text-muted-foreground">No account needed.</p>
        </div>
        <div className="flex items-center justify-between rounded-2xl bg-accent p-4 text-accent-foreground">
          <div>
            <div className="font-bold">You're booking 1 spot</div>
            <div className="text-sm">{game.title} · {shortDate(game)}, {startTime(game)}</div>
          </div>
          <div className="font-display text-2xl font-extrabold">{formatMoney(game.pricePerPlayer, game.currency)}</div>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {field("firstName", "First name", { auto: "given-name" })}
            {field("lastName", "Last name", { auto: "family-name" })}
          </div>
          {field("email", "Email", { optional: true, type: "email", auto: "email" })}
          {field("phone", "Phone", { optional: true, type: "tel", auto: "tel" })}
          <p className="text-xs text-muted-foreground">Add an email or phone to get your booking confirmation and game updates.</p>
        </div>
      </Page>
      <ActionBar>
        <Button type="submit" size="xl" disabled={!valid || busy || !bookable}>Continue to payment</Button>
      </ActionBar>
    </form>
  );
}
