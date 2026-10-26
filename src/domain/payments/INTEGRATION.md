# Trustless Work integration preparation

Status: **preparation only; V2 beta, Stellar Testnet**. The existing mock provider remains the default. No UI, schema, migration, wallet integration, on-chain transaction or existing mock financial semantics are changed by this preparation.

## Provider selection and server boundary

`provider-factory.server.ts` selects `mock` when `PAYMENT_PROVIDER` is absent, or explicitly `mock`. It reuses the existing mock singleton. `trustless-work` selects the scaffold after validating environment configuration. Unknown values fail rather than silently choosing a provider.

Existing database booking actions use `getBookingPaymentProvider()` before any writes. This rejects the preparation-only provider: setting the environment flag alone cannot turn a mock confirmation into a real payment, create orphan booking records, or pretend to refund funds. Keep `PAYMENT_PROVIDER=mock` until the remaining work below is complete.

The factory, configuration reader and Trustless Work scaffold import TanStack Start's `server-only` marker. No route imports them. The existing `api.ts` server-function boundary dynamically loads database access. `TRUSTLESS_WORK_API_KEY` is read only from server environment, never `import.meta.env`, never a `VITE_` variable, never included in drafts or errors. The configuration is a private class field. No private Stellar keys are read, generated or stored. `.env.example` documents all required fields; local `.env` was not changed.

## Implemented scaffold surface

| Method | Current behavior | Required live implementation |
| --- | --- | --- |
| `provisionEscrow` | Validates game/roles and returns blocked, not-provisioned draft | Idempotent deployment, admin signature, confirmed contract mapping |
| `preparePayment` | Validates active escrow identity, asset, payer and amount; blocked draft | Reservation, intent persistence, funding XDR, player wallet signature |
| `reconcilePayment` | Returns reconciliation-required; never marks confirmed | Verify successful transaction/token/payer/amount/destination; unique deposit consumption |
| `recordRefundObligation` | Produces approved obligation draft; explicitly blocked on persistence | Transactional durable record with policy snapshot and idempotency |
| `prepareSettlement` | Pure net-entitlement plan, operator/resolver identities; blocked on fee simulation | Actual fee quote, gross allocation construction, signature sequence |
| `reconcileSettlement` | Returns reconciliation-required; never marks confirmed | Verify every actual net transfer and update obligations/payout atomically |

No method calls the Trustless Work API. None fabricates XDR, contract IDs, transaction hashes, successful payments or durable persistence. Legacy `createPayment`, `confirmPayment`, `refundPayment` and `getPaymentStatus` throw for the scaffold. Existing mock behavior stays intact.

## Domain and amount assumptions

- One single-release escrow per game. `engagementId` is the game ID, but on-chain/global uniqueness is not assumed; future database uniqueness is required.
- Players are depositors only. Preparation rejects a player matching any escrow role, including admin, resolver, platform, operator or organizer. Repeat this validation for every new payer, not just creation-time player lists.
- Admin and Resolver are separate dedicated accounts. Operator initiates disputes. Resolver authorizes distributions. Organizer may share operator/platform for the MVP. Neither authority-only Admin nor Resolver needs EURC unless later receiving/funding tokens.
- Cancellation records an application refund entitlement, not an immediate blockchain transfer. Whole-game cancellation must consolidate existing pending obligations to 100% rather than duplicate or omit previously cancelled payments.
- Existing Game.currency still describes the business price (EUR minor units). EURC is separately configured settlement-asset metadata. This scaffold supports EUR-priced games; other currency conversions are explicitly rejected, not assumed.
- Token amounts use integer `bigint` arithmetic internally and decimal integer strings in domain records. EURC has seven decimals. Existing business refund rounding is preserved via `refundMinorUnits`, taken from the game's currency snapshot; token-level fee math retains seven decimals.
- Refund percentages are integer 0–100, matching current database configuration. Prices, capacities and policy come from Game, not fixed example constants.
- A settlement plan specifies **net entitlements**, not the gross `distributions` payload accepted by Trustless Work. `quotedFeesAtomic` is an explicit caller-supplied quote; tests using 0.3% are synthetic, not measured fees.
- Organizer payout = max(balance − approved net refunds − quoted fees, 0). A deficit returns `funding_required`; the minimum additional funding is only the shortfall at that quote. Top-ups change the fee basis and require another quote/simulation. A full refund must never silently become 99.7%.
- Allocations aggregate refunds by wallet and reject duplicate payment obligations, wrong-game records, already-settled refunds and more than 50 recipients. Completed game history and settlement state remain separate.
- Environment address validation currently checks shape and role separation. SDK checksum/SAC derivation, Testnet RPC identity, balances/trustlines and actual contract identity must be verified again before live actions.

## Exact remaining live sequence

1. **Provider prerequisite:** obtain confirmation that Trustless Work fixed the EURC trustline/configuration for fee account `GA6KH5VWPCHBOEF63X57SPX6T4H366YFFKKGCVDBTXT2N7JVL6PJCK7G`. Read its Testnet trustline once to verify. Do not repeatedly attempt deployment while unresolved.
2. Keep the app in mock mode. In the isolated spike, recheck asset, role accounts and API access. Run `node cli.mjs prepare game-a deploy` once after the fix. Validate V2 roles, Testnet XDR hash and configured EURC asset. Stop for the dedicated **GameLock Admin** signature in Freighter. No player is an admin or resolver.
3. Submit through the spike's server-only REST client; verify Testnet success and record the actual contract ID/hash. A build response or predicted contract ID alone does not mean deployed.
4. Prepare Player 1's 7 EURC funding to that contract, request its signature, submit and independently verify the deposit. Repeat for Player 2 against the **same contract**, with separate intent/hash/evidence.
5. Record a 5.60 EURC entitlement for the 80% cancellation example. At settlement, organizer/operator opens the dispute. Resolver signs the final gross distribution. Measure exact player and organizer receipts plus protocol/platform fees; distinguish 80% gross allocation from literal 80% net refund.
6. Use a separate escrow for all-player 100% refund testing. Measure deductions; if necessary use another fresh escrow with a fee subsidy funded **before** dispute. Simulate gross allocations and integer rounding until both players receive at least their principal; record any surplus/dust. Resolution is terminal.
7. Retain escrow IDs, submitted hashes, ledgers, transfer events, gross allocations, fee destinations, net amounts, network fees and any API inconsistencies in spike evidence. Verify SDK RPC event parsing against real transactions before using it in application reconciliation.
8. Only after these pass: design and review schema changes for game escrow mapping, payment attempts, immutable verified deposits, refund obligations and settlement records. Add atomic reservations/idempotency, restricted financial writes, authenticated operator actions and transaction recovery. Database writes continue to live in `db.server.ts`.
9. Connect a server-only REST transport and independent chain verifier to this scaffold; wire browser signing through store actions/server functions. Add operator/resolver settlement actions and lifecycle reconciliation, preserving the existing UI design and completed-game history. Switch provider only after end-to-end tests pass.

Source references: installed `trustless-work-dev` V2 core concepts; [deploy](https://docs.trustlesswork.com/trustless-work/v2-en/api-rest/deploy/initialize-escrow), [fund](https://docs.trustlesswork.com/trustless-work/v2-en/api-rest/deploy/fund-escrow), [resolve](https://docs.trustlesswork.com/trustless-work/v2-en/api-rest/deploy/resolving-disputes). Live measurements remain in the isolated spike's RESULTS.md; this preparation makes no new live compatibility claims.
