# GameLock

Commit to the game. Reserve a spot, pay in EURC, and get a booking confirmed after on-chain verification.

[Product site](https://gamelock.lovable.app) · [Submission copy](SUBMISSION.md) · [105-second demo](DEMO-SCRIPT.md) · [Pitch outline](PITCH-OUTLINE.md)

## Problem

Pickup games fill in WhatsApp, but a message is not a financial commitment. Players cancel late, the organizer still pays for the venue, and everyone else gets a worse game.

## Solution

GameLock lets players discover a game, reserve a spot, pay in advance, receive booking confirmation only after verified payment, and receive policy-based refunds. Organizers manage games, players, payments, and refunds from one dashboard.

## Live Hackathon Flow

**Player → Freighter → 7 EURC on Stellar Testnet → Organizer → server-side transaction verification → booking confirmed → early cancellation → 5.6 EURC refund → on-chain verification.**

Both transfers have completed end-to-end. The Organizer signs the refund in Freighter; GameLock marks it complete only after independently verifying it on-chain. Duplicate refund protection preserves the original payment and refund transaction references.

The working provider is native Stellar EURC: funds go directly to the Organizer. This flow is not escrow. The verified demonstration ran locally; hosted native-provider configuration must be checked before presenting the product site as a live payment demo.

## Why Stellar

Stellar provides low-cost transfers, EURC asset support, fast settlement, and transparent on-chain verification. Its programmable ecosystem provides a path toward escrow and automated settlement. The current demo uses classic Stellar payments; Soroban escrow is a future integration.

## Architecture

React and TypeScript, with TanStack Start, build on a Lovable-generated product foundation. UI-free domain modules handle game rules and integer minor-unit money. The store calls server functions; a database layer maps persisted games, players, bookings, payments, and refunds to domain types in Lovable Cloud/Supabase.

```text
React UI → domain store → TanStack server functions → database layer → Supabase
                                  |
                         PaymentProvider abstraction
                                  |
                         Native Stellar EURC provider
                                  |
Browser Freighter ← unsigned transaction
       |                          |
       └─ signed transaction → server → Stellar Testnet / Horizon
                                  |
                         verified receipt → persisted booking/refund

Separate provider preparation + isolated spike → Trustless Work / Soroban escrow
```

Freighter holds signing authority. GameLock stores no private keys or seed phrases. The server independently checks transaction success, ledger inclusion, sender, recipient, asset, amount, and booking/refund memo before recording completion.

## Payment Rules

Example game configuration (rules are configurable per game):

| Event | Rule | On a 7 EURC booking |
| --- | --- | --- |
| Booking | Pay in advance | 7 EURC |
| Early player cancellation, more than 4 hours before start | 80% refund | 5.6 EURC |
| Late player cancellation, 4 hours or less before start | 0% refund | 0 EURC |
| Organizer cancellation | 100% refund | 7 EURC |

Native refunds require an Organizer signature. XLM network fees are separate from the EURC refund amount. The demonstrated on-chain refund is the 80% case; all three policy cases are covered by tests.

## Verified Transactions

Retrieved from the persisted demo payment record on 26 October 2026: status `refunded`, original amount 700 minor units, refund amount 560 minor units.

- **7 EURC payment, Player 1 → Organizer:** [`39923d44a1026d8ba8e1bf88735979443cc4b3465eee4e45e432fac2a1edd538`](https://stellar.expert/explorer/testnet/tx/39923d44a1026d8ba8e1bf88735979443cc4b3465eee4e45e432fac2a1edd538)
- **5.6 EURC refund, Organizer → Player 1:** [`3ca7d9c3c5c59e83ea332e46c7740b38c6bae5b6c648fae490630f194c49dd3b`](https://stellar.expert/explorer/testnet/tx/3ca7d9c3c5c59e83ea332e46c7740b38c6bae5b6c648fae490630f194c49dd3b)

## Trustless Work Integration

A V2 beta integration harness was implemented and tested in an isolated spike, alongside a prepared application provider. Receiver and payload checks were valid; deployment encountered an upstream beta blocker: the provider-controlled protocol-fee wallet lacked the exact EURC Testnet issuer/code trustline. Independent Horizon inspection confirmed this during integration testing on 25 October 2026.

No escrow was deployed. Native Stellar EURC became the working hackathon fallback, and Trustless Work remains a future escrow provider. See [recorded spike evidence and scope](spikes/trustless-work-eurc/RESULTS.md); live escrow funding and settlement remain unverified.

## How to Run Locally

Use Bun for the committed lockfile and Node.js 22.12+ for the explicit environment-loading startup command (validated here with Node 24).

```sh
bun install --frozen-lockfile
cp .env.example .env
```

For an existing checkout, retain the existing `.env`. Set the following values locally:

```dotenv
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-publishable-key
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
PAYMENT_PROVIDER=stellar-native
GAMELOCK_RECEIVING_ADDRESS=GDBZY43YA2WNTSGUB5VW3ZZE5VEGRNI5H3ZKDVFIITL3ZXUXAPOGWRV6
```

Use the connected database with its existing schema and demo games; a fresh empty Supabase project is not sufficient. The schema is recorded in `drizzle/migrations/0000_create_gamelock_tables.sql`. The first Supabase pair supplies server access; the VITE pair is public browser configuration. Never place secret credentials in VITE variables or commit `.env`. Native mode needs no Trustless Work API key.

Keep the Testnet/EURC values from `.env.example`: native mode pins and validates these settings. From the repository root, start with:

```sh
node --env-file=.env node_modules/vite/bin/vite.js dev --host 127.0.0.1 --port 3001 --strictPort --force
```

Open `http://127.0.0.1:3001` in a browser with Freighter installed. Select **Stellar Testnet**. Both wallets need the exact EURC trustline and XLM for fees; the player needs 7 EURC and the Organizer needs enough EURC to refund. Restart after environment changes. New bookings must be created in native mode; existing mock bookings remain simulated.

Validation: `bun run test`, `bun run typecheck`, `bun run build`. Submission checks on 26 October 2026: **99 tests passed; type-check passed; production build passed**.

## Demo Setup

| Setting | Public value |
| --- | --- |
| Organizer | `GDBZY43YA2WNTSGUB5VW3ZZE5VEGRNI5H3ZKDVFIITL3ZXUXAPOGWRV6` |
| Player 1 | `GCE3TFBA33BOWCSYL5GHRPKGTHFTZ5G2EKK5AUZBQGZME5WFVNBLFCVG` |
| Network | Stellar Testnet |
| EURC issuer | `GB3Q6QDZYTHWT7E5PVS3W7FUT5GVAFC5KSZFFLPU25GO7VTC3NM2ZTVO` |
| EURC asset contract ID | `CCUUDM434BMZMYWYDITHFXHDMIVTGGD6T2I5UKNX5BSLXLW7HVR4MCGZ` |
| Payment / refund | 7 EURC / 5.6 EURC |

The contract ID identifies the associated asset; native payments use asset code and issuer, without invoking a Soroban contract.

## Business Model

Proposed revenue is a per-booking platform fee: test a 5–8% fee or a fixed fee with organizers. Fee collection is not demonstrated in the live native flow. Start with recreational basketball, then expand to other sports, using configurable pricing and cancellation policies.

## Roadmap

Production authentication; hosted wallets and mobile UX; automated settlement; Trustless Work/Soroban escrow; notifications; Mainnet launch after production hardening; multi-sport and multi-city expansion.

## Known Limitations

- Testnet only; native Stellar is the live hackathon payment provider.
- Organizer-signed refunds; no automated settlement or live escrow.
- No production authentication yet; the public MVP database is not protected against malicious direct modification.
- Not production-ready for custody/compliance or real-money operations.
- Concurrent capacity checks and multi-row cancellations are not atomic; this is a supervised demo.

Older payment audit notes describe intermediate milestones. This README records the final verified submission state.
