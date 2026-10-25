import { Link, useRouter } from "@tanstack/react-router";
import { cva } from "class-variance-authority";
import { ArrowLeft, CheckCircle2, Clock, Ban, Users } from "lucide-react";
import type { ReactNode } from "react";
import type { GameStatus, PaymentStatus } from "@/domain/types";
import { cn } from "@/lib/utils";

export function AppHeader({ back, right }: { back?: boolean; right?: ReactNode }) {
  const router = useRouter();
  return (
    <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-xl items-center gap-3 px-4">
        {back && (
          <button aria-label="Back" onClick={() => router.history.back()} className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        <Link to="/" className="font-display text-lg font-extrabold tracking-tight">
          Game<span className="text-primary">Lock</span>
        </Link>
        <div className="ml-auto">{right}</div>
      </div>
    </header>
  );
}

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <main className={cn("mx-auto w-full max-w-xl px-4 pb-32 pt-5", className)}>{children}</main>;
}

/** Sticky bottom action bar — one clear decision per screen. */
export function ActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-card/95 backdrop-blur">
      <div className="mx-auto max-w-xl space-y-2 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{children}</div>
    </div>
  );
}

const statusStyles = cva("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", {
  variants: {
    status: {
      confirmed: "bg-success-soft text-success",
      pending: "bg-warning-soft text-warning",
      sold_out: "bg-secondary text-secondary-foreground",
      cancelled: "bg-danger-soft text-destructive",
    },
  },
});

export const statusLabel: Record<GameStatus, string> = {
  confirmed: "Game confirmed",
  pending: "Waiting for confirmation",
  sold_out: "Sold out",
  cancelled: "Game cancelled",
};

export function StatusBadge({ status }: { status: GameStatus }) {
  const Icon = { confirmed: CheckCircle2, pending: Clock, sold_out: Users, cancelled: Ban }[status];
  return (
    <span className={statusStyles({ status })}>
      <Icon className="h-3.5 w-3.5" />
      {statusLabel[status]}
    </span>
  );
}

const payChip = cva("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", {
  variants: {
    status: {
      successful: "bg-success-soft text-success",
      pending: "bg-warning-soft text-warning",
      failed: "bg-danger-soft text-destructive",
      refund_pending: "bg-accent text-accent-foreground",
      refund_completed: "bg-muted text-muted-foreground",
    },
  },
});
const payLabel: Record<PaymentStatus, string> = {
  successful: "Paid",
  pending: "Pending",
  failed: "Failed",
  refund_pending: "Refund initiated",
  refund_completed: "Refunded",
};
export function PaymentChip({ status }: { status: PaymentStatus }) {
  return <span className={payChip({ status })}>{payLabel[status]}</span>;
}

export function CapacityBar({ paid, min, max }: { paid: number; min: number; max: number }) {
  const pct = Math.min(100, (paid / max) * 100);
  const minPct = (min / max) * 100;
  const reached = paid >= min;
  return (
    <div className="relative h-2.5 w-full rounded-full bg-muted" role="progressbar" aria-valuenow={paid} aria-valuemax={max}>
      <div className={cn("h-full rounded-full transition-all", reached ? "bg-success" : "bg-primary")} style={{ width: `${pct}%` }} />
      <div className="absolute -top-1 h-4.5 w-0.5 rounded bg-foreground/40" style={{ left: `${minPct}%` }} title={`Minimum ${min}`} />
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border bg-card p-5">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}

export function InfoRow({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground [&_svg]:h-4.5 [&_svg]:w-4.5">{icon}</div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="font-semibold">{value}</div>
      </div>
    </div>
  );
}
