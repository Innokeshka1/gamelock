# GameLock / EURC compatibility spike

**Hackathon experiment only. Trustless Work V2 BETA. Stellar Testnet only.**
This directory is independent of GameLock's UI, database, server functions and booking flows. No custom contract. No private-key generation or storage. Do not promote this harness to production.

## Install and preflight

Requires Node 22.12+ (including `node:util.parseEnv`) and pnpm. Run from this directory:

```sh
pnpm install --frozen-lockfile
pnpm test
node cli.mjs preflight
```

The API key is read from `TRUSTLESS_WORK_API_KEY` in the process environment, otherwise from the repository root `.env`. Only that property is consumed. The key never reaches the browser. Do not paste it into a command argument, artifact, issue or chat.

Preflight verifies Testnet RPC identity, derives the Stellar Asset Contract ID from EURC+issuer, checks Horizon's asset record, simulates token `decimals()` and `symbol()` without signing, then attempts an authenticated beta API read. It saves public results under ignored `artifacts/`. A failed API request prints only status/code/path, not upstream error bodies or headers.

## Wallet gate (manual)

Copy `wallets.example.json` to ignored `wallets.json`. Enter public `G...` addresses only. The fields are admin, operations, resolver, platform, organizer, playerA and playerB. Admin and resolver must be distinct from one another and the operational role addresses. The two depositors must differ. Platform fee is zero.

Players are **funders/depositors only**, with no escrow role or dispute authority. The harness rejects any overlap between either player and admin, operations, resolver, platform or organizer. Organizer may hold operations/platform/service provider/receiver for this spike. Dedicated GameLock admin and resolver addresses are now configured in the ignored local file. No player is an approver, release signer, admin, or resolver. This setup uses five distinct accounts (two players, organizer/operator, admin, resolver). Role composition still needs a successful provider build/simulation.

Admin and resolver do not need EURC trustlines for authority-only deployment/resolution signatures: they neither deposit nor receive EURC in this plan. Operations opens the dispute. If admin/resolver later become token funders or recipients, they will need the trustline. Run `node check-role-accounts.mjs` to inspect their Testnet XLM balances and reserves without calling Trustless Work deployment.

### Domain and settlement assumptions

- A player's cancellation/refund request is an application event. GameLock computes and records the approved refund entitlement using configured policy and server time. No on-chain dispute or transfer happens at that point.
- At final settlement, GameLock/the organizer-side operator opens the escrow dispute by signing with `operations`. A player never signs a dispute-opening transaction.
- The distinct resolver signs a distribution plan containing the approved player refunds and the remaining organizer proceeds. Players receive EURC without needing escrow authority or signing the resolution.
- Keep original deposit evidence, refund entitlement and actual net refund settlement as separate records. Mark refunds paid only after confirming recipient transfers. Gross allocations may be reduced by fees; net-refund promises still require measured fee handling.
- Game completion and financial settlement are separate lifecycle states; completed game history is retained. This spike does not implement application persistence or change existing booking flows.

In Freighter: use the network selector to choose **Testnet**. Select/create each account inside the wallet and copy its public address into the corresponding field. Keep seed phrases and secret `S...` keys inside your wallet; never put them in this repository or send them to the agent.

Fund account XLM via Freighter's Testnet funding control / Stellar Friendbot. Add the EURC asset using code `EURC` and issuer:

```
GB3Q6QDZYTHWT7E5PVS3W7FUT5GVAFC5KSZFFLPU25GO7VTC3NM2ZTVO
```

Token contract:

```
CCUUDM434BMZMYWYDITHFXHDMIVTGGD6T2I5UKNX5BSLXLW7HVR4MCGZ
```

Player A and B each need at least **14 EURC** for the first two scenarios (7 per escrow). Organizer needs a EURC trustline and a small EURC reserve for any later fee subsidy. Friendbot gives XLM, not EURC: obtain this exact Testnet asset from your mentor/issuer faucet. Do not substitute another token with the same symbol. Every signing account needs sufficient spendable XLM above reserves for its fees; the readiness check is preliminary, simulation is authoritative.

```sh
node cli.mjs wallets
```

Stop if accounts, trustlines or funding are missing.

## Exact test flow

Each prepare command builds unsigned XDR, stores an immutable named intent and prints the signing account. For **every** intent:

1. Run `node signer-server.mjs INTENT_NAME`.
2. Open `http://127.0.0.1:4318/` in a browser with Freighter.
3. Select the required account, review the displayed intent, click **Connect Freighter, sign and submit this transaction**, then approve Freighter's requests.
4. Run `node cli.mjs verify INTENT_NAME` after submission. If pending/not found, retry verification, not funding.
5. Stop the signing server before opening the next intent.

The signing server binds only to loopback, validates Origin/Host and an unpredictable session token, and checks the signed transaction hash and signer. It persists a submission-attempt marker before network I/O, and refuses automatic resubmission. It does not write signed XDR to disk. Reject any unexpected transaction in Freighter.

### Scenario A: two deposits, one 80% gross refund allocation

```sh
node cli.mjs prepare game-a deploy
# Sign and verify game-a; use its verified intent.contractId as CONTRACT_A.
node cli.mjs prepare game-a-player-a fund CONTRACT_A playerA 7
# Sign and verify.
node cli.mjs prepare game-a-player-b fund CONTRACT_A playerB 7
# Sign and verify independently.
node cli.mjs prepare game-a-dispute dispute CONTRACT_A
# Operations signs; verify.
```

Create an ignored `artifacts/game-a-distribution.json`, substituting actual addresses:

```json
[
  { "address": "PLAYER_A_PUBLIC_ADDRESS", "amount": "5.6" },
  { "address": "ORGANIZER_PUBLIC_ADDRESS", "amount": "8.4" }
]
```

```sh
node cli.mjs prepare game-a-resolve resolve-dispute CONTRACT_A artifacts/game-a-distribution.json
# Resolver signs; verify.
```

This intentionally measures **80% gross allocation**, not a promise of 5.60 net. Record each actual token transfer and the difference. The protocol recipient is reported as an observed fee destination, not guessed from an address.

### Scenario B: 100% gross allocation

Repeat deployment under `game-b`, then 7 EURC from each player. Dispute and resolve with gross allocations 7 EURC to each player. Compare actual net receipts to 7. This empirically establishes whether a subsidy is needed. Resolution is terminal; you cannot top up this scenario afterward and repeat its resolution.

### Scenario C: literal 100% net, only if scenario B shows deductions

Create a fresh escrow, repeat two player deposits, then fund the calculated fee subsidy from `organizer` **before** opening the dispute. Base the subsidy on measured fee behavior, and verify the actual contract's rounding with simulation before signing. For a measured 0.3% fee and 14 EURC principal, the continuous approximation is `14 / 0.997 - 14`; this is NOT an executable exact amount. Do not assume fees are the same across deployments.

Create distributions whose gross sum equals the exact on-chain balance, with net targets of at least 7 EURC per player. This phase deliberately requires review after measurement; there is no guessed automatic subsidy. Verify actual transfers and record surplus/dust separately from the promised refund.

## Evidence and limitations

`*-verified.json` includes transaction hash, ledger, raw RPC transaction result, decoded EURC transfer events, gross allocations, net recipients, fee transfers and XLM network fee separately. Funding verification checks payer+token+escrow+amount, not just API success. Settlement verification requires outgoing EURC transfers to sum to the gross plan. Token transfer event queries are paginated; run verification promptly while RPC history is retained.

One verified deployment receipt is required before this harness will fund/dispute/resolve a contract. Named intents are not overwritten. There is no booking database, scheduler or production authorization model here.

Local unit tests use **synthetic fixtures**; they are not evidence of executed transactions. Freighter, deployment, funding, settlement and RPC event verification remain unproven until actually exercised with real Testnet wallets. An API accepted/build response alone is not a successful payment.

## API version notes

- Host: `https://beta.api.trustlesswork.com` (V2 beta / Testnet).
- Read probe: `GET /escrows?limit=1`.
- Build: `POST /escrow/single-release/v2/{deploy,fund,dispute,resolve-dispute}`.
- Submit: `POST /stellar/send-transaction`.
- Escrow read: `GET /escrow/single-release/v2/:contractId`.
- The current build schema says `unsignedXdr`; some submission prose still says `unsignedTransaction`. The harness rejects incompatible shapes instead of silently accepting them.
- Older skill overview text lists the V1 host and helper submission path. The installed V2 core-concepts reference correctly identifies the separate beta host and `/stellar/send-transaction`.

Sources: [Deploy](https://docs.trustlesswork.com/trustless-work/v2-en/api-rest/deploy/initialize-escrow), [Fund](https://docs.trustlesswork.com/trustless-work/v2-en/api-rest/deploy/fund-escrow), [Resolve](https://docs.trustlesswork.com/trustless-work/v2-en/api-rest/deploy/resolving-disputes), [Submit](https://docs.trustlesswork.com/trustless-work/v2-en/api-rest/stellar/send-transaction).
