<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture
- Business logic lives in `src/domain/` (types, game status, refunds, money, payments) and must stay UI-free; routes only call store actions/selectors — keeps logic testable and reusable.
- Payments go through the `PaymentProvider` interface (`src/domain/payments`); swap the mock for a real provider (e.g. Stellar) without touching UI.
- No sport/city/currency/price/limit is hardcoded in logic; all come from `Game` config. Money is integer minor units, formatted via `src/domain/money.ts`.
- Lovable Cloud is connected. App data (games, players, bookings, payments, refunds) lives in the database; `src/domain/data/db.server.ts` does all database access and row→domain mapping, exposed through `createServerFn` wrappers in `src/domain/data/api.ts`. `src/domain/store.ts` keeps its public API but is backed by those server functions; the root route loader primes it with a database snapshot. No auth yet — the MVP is fully public per spec.
