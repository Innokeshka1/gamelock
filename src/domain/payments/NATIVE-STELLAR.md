# Native EURC Testnet hackathon milestone

Update: the first payment succeeded. The native refund MVP is now described in [NATIVE-REFUNDS.md](./NATIVE-REFUNDS.md); its refund instructions supersede the historical no-refunds statements below.

This provider transfers EURC directly from the player to the configured receiving wallet. It is not escrow. Trustless Work code/spikes remain unchanged. No new authentication, smart contracts, refund handling, settlement, scheduler or database migration is included.

## Enable and run

Set server environment variables (never `VITE_`):

```dotenv
PAYMENT_PROVIDER=stellar-native
GAMELOCK_RECEIVING_ADDRESS=GDBZY43YA2WNTSGUB5VW3ZZE5VEGRNI5H3ZKDVFIITL3ZXUXAPOGWRV6
```

These are already set in the ignored local `.env`. Configure them separately in the deployment environment before a hosted test. Native mode is pinned to Stellar Testnet, EURC, issuer `GB3Q6QDZYTHWT7E5PVS3W7FUT5GVAFC5KSZFFLPU25GO7VTC3NM2ZTVO`, token contract `CCUUDM434BMZMYWYDITHFXHDMIVTGGD6T2I5UKNX5BSLXLW7HVR4MCGZ`, seven decimals, and SDF's Testnet Horizon. Conflicting existing asset/network environment values are rejected. The token contract ID is checked by SDK derivation; native transfers use classic issuer/code, not a Soroban invocation.

Use the repository's Bun workflow: `bun install --frozen-lockfile`, `bun run dev`. The existing Bun lockfile includes the official Stellar SDK 17.3.0 and Freighter API 6.0.1. `bun run typecheck`, `bun run test`, `bun run build` run validation.

## Player 1 manual test

1. Open the running local app at `http://127.0.0.1:3000` in a browser with Freighter installed; the Codex in-app browser does not supply the extension.
2. Unlock Freighter, select **Testnet**, and select Player 1: `GCE3TFBA33BOWCSYL5GHRPKGTHFTZ5G2EKK5AUZBQGZME5WFVNBLFCVG`.
3. Join **Pickup Basketball Lisbon** (`/games/pickup-lisbon-thu`, currently EUR 7 with two spots remaining at the smoke check), or another available EUR 7 game. Create a **new** booking after native mode is enabled. Existing mock bookings remain mock and cannot be converted/confirmed through the native endpoint.
4. On the existing checkout click **Pay with Freighter** and approve wallet connection. The server checks both exact EURC trustlines, authorization, spendable EURC, receiver capacity and player XLM reserve/fee headroom.
5. In Freighter review exactly **one payment**, **7.0000000 EURC**, exact issuer above, receiver `GDBZY43YA2WNTSGUB5VW3ZZE5VEGRNI5H3ZKDVFIITL3ZXUXAPOGWRV6`, Stellar Testnet, a booking-bound hash memo and the XLM network fee. Sign within five minutes (or the earlier booking deadline). Only the player signs in Freighter.
6. The server submits that exact signed body, then independently reads Horizon's transaction by hash. It requires success, ledger inclusion, the exact sender, receiver, issuer/code, seven-decimal amount, one payment operation and booking memo. A changed body or extra operation is rejected before submission.
7. Only a verified transaction causes `payments.status=successful`, `payments.external_reference=<64-character Stellar hash>`, then `bookings.status=confirmed`. The booking page links to the Testnet transaction explorer. Refresh to confirm persistence; repeat checkout must not make a second charge.

## Persistence and retry safety

No migration: `payments.provider` already stores the provider ID and `payments.external_reference` is an existing string field. Initially it stores `stellar-native:<bookingId>`. Preparation compare-and-sets it to JSON containing a version, unsigned XDR, expected hash and payer **before** returning XDR to the browser. On verified payment it becomes the raw transaction hash. Unconfirmed JSON is not exposed through the app snapshot.

One saved intent per booking prevents two competing preparation requests from returning different payable transactions. Its memo is SHA-256 of `gamelock:booking:<bookingId>`, preventing reuse for another booking. A dropped submission response is reconciled by the same hash. Reopening checkout checks that hash before asking for another signature; a repeat signed submission uses the same sequence/body and cannot execute twice. The UI also permits reconciliation after the game window closes. If payment persistence succeeds but booking persistence fails, retry repairs the booking without another payment.

For this minimal milestone, an expired or failed intent is deliberately not automatically replaced. The operator must inspect its hash and chain status before any new payment attempt; there is no public reset endpoint. A wallet rejection leaves the same intent available for signing until expiry. If verification is unavailable, payment remains pending. Never create a replacement booking to recover an uncertain payment.

Native booking cancellation and cancellation of a game containing native payments are blocked, since refunds are not implemented. Existing mock-only flows are preserved. No automatic refund promise is displayed on native checkout/receipt.

## Verification and limits

- Final validation: **78 tests passed** across 9 files; TypeScript `--noEmit` passed; production build passed; `git diff --check` passed. Built browser JavaScript was checked for the local Trustless Work credential and server API-key setting; neither was present. Existing bundler/deprecation warnings remain non-fatal.
- Automated tests cover exact amount conversion, factory isolation, Testnet config, both trustlines, issuer mismatch, authorization, balance/liabilities, receiver limits, XLM fee reserve, altered transactions, cross-booking replay, failed receipts, ambiguous submission, immutable preparation/CAS, database retry repair, Freighter rejection/network/account changes and checkout messaging.
- Live read-only preflight at **2026-10-26T01:23:20.705Z** passed using this provider and the actual Player 1 and organizer accounts. It built an unsigned 7 EURC transaction, with zero signatures, for a diagnostic memo, not a real booking. It was not submitted. Player 1 and organizer trustline/balance checks passed.
- No real signed native payment or live payment-status database write has yet been demonstrated. The first end-to-end confirmation requires the user's Freighter signature.
- Existing public/no-auth database access remains unchanged. This is a supervised Testnet demo, not production authorization or tamper-resistant accounting. Existing cross-booking capacity checks are not an atomic seat-reservation system.
- Production build targets the existing Cloudflare/Nitro configuration with `nodejs_compat`. Deploy configuration must supply the server environment values; local `.env` is not published.

## Files in this milestone

- New: `native-stellar.server.ts`, `freighter.client.ts`, `native-stellar.test.ts`, `freighter.test.ts`, `../data/native-payment.test.ts`, this document.
- Updated: `provider-factory.server.ts`, `../data/api.ts`, `../data/db.server.ts`, `../store.ts`, `../types.ts`, `../game-logic.ts`.
- UI: `../../routes/checkout.$bookingId.tsx`, `../../routes/bookings.$bookingId.tsx`; existing layout retained.
- Tests/config: `../../test/booking-lifecycle.test.tsx`, repository `.env.example`, `.gitignore`, `package.json`, `bun.lock`, ignored local `.env`.

Official patterns: [Freighter signing](https://docs.freighter.app/extension-freighter-api/signing.md), [Horizon transaction receipt](https://developers.stellar.org/docs/data/apis/horizon/api-reference/resources/transactions/object).
