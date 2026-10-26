# GameLock pre-demo checklist

Update: the first real 7 EURC payment succeeded. Player 1's booking is now cancelled with a 5.6 EURC refund pending; the Organizer-signing flow is documented in [NATIVE-REFUNDS.md](src/domain/payments/NATIVE-REFUNDS.md). Its refund instructions supersede the earlier no-refunds limitations below. No refund has yet been signed/submitted.

Audit: 26 October 2026. **PASS for a supervised first Testnet payment.** No signature or transaction was requested/submitted during this audit. End-to-end signed payment remains to be demonstrated.

## Environment and local startup

Keep these in the ignored repository `.env` (retain the existing Supabase values):

```dotenv
SUPABASE_URL=<existing project URL>
SUPABASE_PUBLISHABLE_KEY=<existing publishable key>
VITE_SUPABASE_URL=<same project URL>
VITE_SUPABASE_PUBLISHABLE_KEY=<same publishable key>
PAYMENT_PROVIDER=stellar-native
GAMELOCK_RECEIVING_ADDRESS=GDBZY43YA2WNTSGUB5VW3ZZE5VEGRNI5H3ZKDVFIITL3ZXUXAPOGWRV6
```

The first two variables supply server database access; the VITE pair supplies the existing browser Supabase client. Native mode requires the last two. Without explicit `PAYMENT_PROVIDER=stellar-native`, the factory defaults to mock. Never put credentials in VITE variables. `TRUSTLESS_WORK_API_KEY` is not needed for native payments; preserve its existing server-only configuration.

Native Testnet settings are pinned in code. They need not be added to `.env`; if present, they must match exactly:

```dotenv
STELLAR_NETWORK=testnet
STELLAR_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
EURC_SYMBOL=EURC
EURC_DECIMALS=7
EURC_ISSUER=GB3Q6QDZYTHWT7E5PVS3W7FUT5GVAFC5KSZFFLPU25GO7VTC3NM2ZTVO
EURC_CONTRACT_ID=CCUUDM434BMZMYWYDITHFXHDMIVTGGD6T2I5UKNX5BSLXLW7HVR4MCGZ
```

Exact startup command on this laptop (explicitly loads server variables; Bun was unavailable on the audit shell PATH):

```sh
cd /Users/innokentiy/Documents/gamelock
/Users/innokentiy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --env-file=.env node_modules/vite/bin/vite.js dev --host 127.0.0.1 --port 3001 --strictPort --force
```

Open http://127.0.0.1:3001 in a browser with Freighter installed. Port 3000 was already occupied during audit; 3001 startup was verified. If 3001 is occupied tomorrow, stop the previous GameLock process in its terminal with Ctrl-C and rerun; do not kill unrelated processes. Restart after environment changes.

Local disabled-button follow-up: reproduced a valid-looking form stuck disabled because missing `node_modules/.vite/deps` files prevented React hydration. Restarting with `--force` regenerated dependencies and restored interaction; no lifecycle bypass or source-logic change was needed. If this recurs, stop this server, rerun the command above, reload the browser, and wait for hydration before entering names. Actual statuses at 26 October 08:56 UTC: Thursday `confirmed` (13/15 paid), Friday `sold_out` (15/15), Sunday `pending` (8/10 minimum, 15 maximum), and the €8 game `pending` (0/10 minimum, 15 maximum). All end dates are in the future; neither pending game has passed its confirmation deadline.

Runtime follow-up, 26 October: reproduced organizer lazy-import failure and Freighter module import failure. Server errors identified missing optimized `@radix-ui/react-dialog`, `@radix-ui/react-alert-dialog` and `@stellar/freighter-api` files; the whole shared `node_modules/.vite/deps` directory was absent. Source HTTP 200 did not establish that its dependencies could execute. The process that removed the cache was not established. Stop Vite before clearing its cache; restart with `--force` and reload browser tabs afterward. Rebuilding restored home, organizer (including payment tab), New game dialog, enabled booking form, existing native checkout, and actual Freighter module evaluation. The isolated module check invoked no wallet functions and was removed afterward. No application-code correction or database write was needed for these two failures.

## Exact payment and expected result

- Player 1: `GCE3TFBA33BOWCSYL5GHRPKGTHFTZ5G2EKK5AUZBQGZME5WFVNBLFCVG`.
- Organizer/recipient: `GDBZY43YA2WNTSGUB5VW3ZZE5VEGRNI5H3ZKDVFIITL3ZXUXAPOGWRV6`.
- Amount: **7 EURC**, displayed as `7.0000000` on-chain; game price is 700 EUR minor units.
- Freighter network: **Testnet**, passphrase `Test SDF Network ; September 2015`.
- Use a new booking for **Pickup Basketball Lisbon**, `/games/pickup-lisbon-thu`. Audit read: EUR 7, 13 confirmed bookings of 15, no cancellation, confirmation deadline 29 October 12:00 UTC, end 29 October 22:00 UTC. Recheck availability tomorrow.
- Read-only Horizon check: Player 1 and organizer each had 20 EURC, authorized exact-issuer trustlines, zero liabilities, and ample XLM. With no other transfers, balances after payment should be 13 and 27 EURC respectively.

Freighter should show Player 1 signing **one payment** of **7 EURC** to the exact organizer above, exact EURC issuer above, Testnet, a hash memo binding the booking, and a network fee of **0.00001 XLM** (100 stroops). Inspect transaction details if fields are collapsed. Reject if anything differs. No escrow deployment, token approval, trustline change, extra operation, or organizer signature is part of this flow. Sign within five minutes of preparation, or the earlier booking deadline.

Flow: Player 1 connects → server checks balances/trustlines and saves one unsigned intent → Freighter signs → server checks and submits that exact transaction → Horizon receipt must prove success, ledger inclusion, sender, recipient, asset, amount and booking memo → payment becomes `successful` with its hash → booking becomes `confirmed`.

Success in GameLock: confirmed booking/paid receipt and **View verified Stellar transaction** link; refresh must preserve it. Game status is separate from booking status. Verify the hash at `https://stellar.expert/explorer/testnet/tx/<hash>` or `https://horizon-testnet.stellar.org/transactions/<hash>`. Confirm success and inspect the payment operation; a wallet signature alone is not payment confirmation.

## Recovery, retry, and rollback

If signing succeeds but GameLock does not update, save the booking URL and any displayed transaction hash. Stay on/reopen **the same booking**. Refresh; if pending, use its checkout / **Check payment status**, then **Pay with Freighter**. The server checks the saved hash before requesting another signature and repairs an interrupted booking write after payment persistence. Freighter connection/unlock is still required for this path.

If the hash is already successful, do not authorize another payment: retry the same booking to reconcile. If chain verification is unavailable, wait and retry later. If not yet found and the saved intent is unexpired, the same booking can ask to sign the **same transaction** again; it retains its hash/sequence and cannot execute twice. Do not change wallets, manually send EURC, reset payment records, or create a replacement booking while payment is uncertain.

Expired or failed intents are not automatically replaced. Stop and have the operator read the saved intent/hash from `payments.external_reference`, inspect Horizon and its expiry, and reconcile before authorizing any new booking. A 404 alone during a timeout is not proof that payment cannot land. Never change database status to paid merely because signing succeeded.

Rollback: first reconcile any submitted/uncertain native payment while native mode remains enabled. Then stop the local server, set `PAYMENT_PROVIDER=mock` in `.env`, restart, and use a **new mock booking**. Preserve existing native records and Trustless Work files. Mock mode disables native reconciliation until native mode is restored. This rollback does not reverse an on-chain transfer; native refunds are not implemented.

## Audit and limitations

- 83/83 tests passed (9 files), including five additional booking eligibility cases; type-check and production build passed; diff whitespace check passed. Commands used installed Node with `node_modules/vitest/vitest.mjs run`, `node_modules/typescript/bin/tsc --noEmit`, and `node_modules/vite/bin/vite.js build`.
- Repository text scan, including ignored local configuration/spike files, found no Stellar secret-key strings or seed-phrase assignments; terminology matches were documentation only. Dependencies and Git object history were outside this scan. `.env` is ignored and untracked.
- All 21 generated public files were checked: no actual Trustless Work key, API-key variable, native server provider or server configuration markers. Server payment/config modules have server-only guards; API handlers dynamically import database code. Browser code receives only payment-specific public data.
- No blocking issue found for this single supervised flow. No source code, visual design, schema, refunds, or features changed; no commit/push.
- Follow-up changed tests/documentation only. Manual browser verification reached the native €7 checkout for Pickup Basketball Lisbon as `Audit Player`, booking `48da8116-0375-4d9c-9224-4118161edc88`. This is an unpaid test booking; no wallet connection, saved transaction intent, signature, or transfer was requested. Create a new booking with the actual player's name for the payment demo.
- Public/no-auth database access remains a known MVP limitation: records are not tamper-resistant against malicious direct database access. This is a supervised Testnet demonstration, not production-safe payment authorization. Capacity checks are not atomic across separate bookings; avoid concurrent demo checkouts.
- Direct transfer to organizer, not escrow. No native cancellation/refunds, automatic expired-intent replacement, or background reconciliation. Network/extension availability and the first real signature remain runtime prerequisites.
- Trustless Work remains prepared but blocked: recorded V2 deployment failure is the provider protocol-fee account's missing EURC trustline (`GA6KH5VWPCHBOEF63X57SPX6T4H366YFFKKGCVDBTXT2N7JVL6PJCK7G`). Stable V1 probe returned HTTP 401 with the existing credential; compatibility remains unvalidated. Neither blocks the separate native transfer. No Trustless Work probe was repeated in this audit.

## Morning sequence

1. Open the laptop, connect to the internet, and open Terminal in `/Users/innokentiy/Documents/gamelock`.
2. Check `.env` has native mode and the exact organizer address; run the startup command above.
3. Open `http://127.0.0.1:3001` in the Freighter-enabled browser.
4. Unlock Freighter, select **Testnet** and the exact **Player 1** address; confirm at least 7 EURC and XLM fee headroom.
5. Open Pickup Basketball Lisbon, confirm €7 and an available spot, and create one new booking. Save its URL.
6. Click **Pay with Freighter** and approve the wallet connection.
7. Review the exact sender, recipient, issuer, **7 EURC**, Testnet, single payment, hash memo and XLM fee; sign once within the expiry window.
8. Wait for GameLock's confirmed booking; refresh to verify persistence. If missing, follow recovery above instead of making a new payment.
9. Open the verified transaction link and confirm the hash succeeded on Testnet with the exact **7 EURC** transfer from Player 1 to organizer.
