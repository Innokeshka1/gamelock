# GameLock — submission fields

## Project name
GameLock

## One-line description
Turn pickup-game RSVPs into paid commitments with verified EURC payments on Stellar.

## Short description
GameLock helps recreational sports organizers fill games with committed players. Players discover a game, reserve a spot, and pay through Freighter. GameLock independently verifies the Stellar transaction before confirming the booking and supports policy-based, on-chain refunds.

## Problem
WhatsApp fills a roster but does not secure commitment. Late cancellations leave organizers paying venue costs and players facing incomplete teams.

## Solution
A single booking journey combines game discovery, advance payment, verified confirmation, clear cancellation rules, and an organizer dashboard. A 7 EURC booking qualifies for a 5.6 EURC refund when cancelled early under the demo policy.

## How Stellar is used
Native EURC transfers on Stellar Testnet move funds from player to organizer. Freighter signs; server-side Horizon checks verify sender, recipient, asset, amount, memo, and successful ledger inclusion. Organizer-signed refunds receive the same independent verification. No private keys or seed phrases are stored.

## Technical architecture
React/TypeScript and TanStack Start on a Lovable-generated foundation; UI-free domain rules; Lovable Cloud/Supabase persistence; server functions and a PaymentProvider abstraction; native Stellar EURC transactions with Freighter and Horizon. A separate Trustless Work V2 beta spike prepares a future Soroban escrow path.

## What is working today
Game discovery and booking, organizer dashboard, a verified 7 EURC payment, and a verified 5.6 EURC refund with duplicate protection. Both hashes are published in the README. All 99 tests, type-check, and production build pass. This is a supervised Testnet MVP with organizer-signed refunds and no production authentication.

## What was built during the hackathon
The hackathon deliverable combines the Lovable product foundation with persistent booking/payment records, a native EURC payment provider, Freighter signing, server-side receipt verification, cancellation/refund handling, and tests. An isolated Trustless Work V2 beta integration identified a provider protocol-fee wallet missing the required EURC trustline; native Stellar provides the working demo. No live escrow deployment or settlement is claimed.

## Business model
Proposed per-booking revenue: a 5–8% platform fee or a fixed fee. Validate pricing with recurring game organizers, then expand across recreational sports. The live demo does not demonstrate platform-fee collection.

## Target users
Independent pickup-game organizers and recreational players, starting with basketball communities in Lisbon and expanding to other sports and cities.

## Why now
Community sports already coordinate online, but informal RSVPs leave organizers exposed. EURC transfers, wallet signing, and transparent verification make it practical to prototype financial commitment around each booking today.

## Future roadmap
Production auth, hosted wallet/mobile UX, automated settlement, Trustless Work/Soroban escrow, notifications, production and compliance hardening before Mainnet, and multi-sport/multi-city support.

## GitHub URL
[INSERT PUBLIC REPOSITORY URL]

## Demo URL
[INSERT VERIFIED DEMO URL]

Existing product site: https://gamelock.lovable.app — verify hosted native-provider configuration before using it as the payment-demo URL. The completed payment/refund demonstration ran locally.

## Demo video URL
[INSERT 90–120 SECOND DEMO VIDEO URL]

## Pitch deck URL
[INSERT PUBLISHED PITCH DECK URL]
