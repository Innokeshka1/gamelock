# Compatibility spike: actual results

Run: 2026-10-25. Trustless Work **V2 beta / Stellar Testnet**.

## A. Worked

- Authenticated `GET https://beta.api.trustlesswork.com/escrows?limit=1` succeeded using the locally supplied API key. Escrow listing contents and the API key were not logged.
- Stellar RPC `getNetwork` confirmed `Test SDF Network ; September 2015`.
- Horizon asset lookup confirmed EURC with issuer `GB3Q6QDZYTHWT7E5PVS3W7FUT5GVAFC5KSZFFLPU25GO7VTC3NM2ZTVO` maps to `CCUUDM434BMZMYWYDITHFXHDMIVTGGD6T2I5UKNX5BSLXLW7HVR4MCGZ`.
- Stellar SDK independently derived that same asset contract ID from the issuer, symbol and Testnet passphrase.
- Read-only Soroban simulations returned symbol `EURC` and **decimals = 7**.
- Five synthetic unit tests passed. Freighter browser bundle compiled.
- The three supplied public wallets passed Horizon account/trustline checks. Observed EURC balances: organizer 20.0000000, Player 1 20.0000000, Player 2 19.0667474. All had Testnet XLM; both players exceed the 14 EURC requirement for two scenarios.
- Public wallet mappings are saved in ignored `wallets.json`. Players are restricted to depositors only. Dedicated non-player admin and resolver addresses are now configured and passed role separation validation.
- At `2026-10-25T21:21:24.206Z`, Horizon confirmed both new role accounts exist with 10000 XLM each, 1 XLM minimum reserve and no native selling liabilities: **9999 XLM spendable each**. The current ledger base reserve was 0.5 XLM (ledger 5387939). This is ample for spike fees; exact Soroban transaction fee checks remain subject to simulation when deployment is unblocked. Evidence: ignored `artifacts/role-account-readiness.json`.
- Neither admin nor resolver currently has an EURC trustline. Neither needs one for its authority-only role in the planned flow: admin signs deployment; organizer/operator opens the dispute; resolver signs transfers from the escrow to players/organizer. They would need the trustline if later funding or receiving EURC themselves.
- Only this spike directory was added. No application code, database schema, booking flow or root dependencies changed.

Public run evidence: ignored `artifacts/asset.json` and `artifacts/preflight.json`. Latest successful repeat verification: `2026-10-25T20:59:31.913Z`. Authenticated API read and EURC identity/7-decimal simulations passed again.

## B. Failed / outstanding

- Initial SDK RPC timeout was mistakenly specified as 30 milliseconds; fixed to 30000 and the rerun passed.
- Sandbox package downloads required network approval. Packages installed; esbuild's install script was blocked by pnpm's default script policy, but the installed platform binary successfully compiled the signing bundle.
- `POST /escrow/single-release/v2/deploy` was attempted twice (second attempt captured the structured diagnostic). Both returned HTTP 422 `ESCROW_RECEIVER_TRUSTLINE_MISSING`. No unsigned transaction was returned and nothing was submitted.
- The missing trustline belongs to Trustless Work's protocol-fee account, **not** the organizer or players: `GA6KH5VWPCHBOEF63X57SPX6T4H366YFFKKGCVDBTXT2N7JVL6PJCK7G`. API role label: `trustlessWork (protocol fee)`. Token: the requested EURC contract.
- Independently queried that account on Horizon: it exists on Testnet and does not have the requested EURC issuer/symbol trustline. Verified at `2026-10-25T21:03:50.433Z`. This requires Trustless Work's account owner to add the trustline (or correct their beta fee-wallet configuration). We cannot sign for that account.
- Diagnostic evidence: ignored `artifacts/deploy-trustline-error.json` and `artifacts/protocol-wallet-readiness.json`. No user signature is requested while this upstream blocker remains.
- Browser signing and live transaction-event verification have not been exercised; compilation and synthetic tests are not proof of live compatibility.

## C. Endpoints actually called successfully

- Trustless Work: `GET /escrows?limit=1` on `https://beta.api.trustlesswork.com`.
- Horizon Testnet: `GET /assets?asset_code=EURC&asset_issuer=...` and `GET /accounts/{issuer}`.
- Soroban Testnet RPC: `getNetwork`, `simulateTransaction` for token `decimals` and `symbol`.

Also called: `POST /escrow/single-release/v2/deploy` on the beta host, twice, both rejected with HTTP 422. Horizon `GET /accounts/{address}` checked all three user accounts and the provider's protocol-fee account.

Implemented, but NOT called: funding, dispute, resolution, submission, versioned escrow read and RPC transaction/event verification.

Documentation inconsistency: submission-page examples use `unsignedTransaction`, while V2 build schemas use `unsignedXdr`. This harness requires the latter and checks the returned hash against the Testnet XDR hash. Operational endpoint permissions are not proven by a successful read.

## D. Actual fees

Unmeasured. No fee-bearing transaction was submitted. The 0.3% figures in test fixtures are hypothetical inputs, not live observations. Additional funding for literal 100% net refund remains to be demonstrated.

## E. IDs and transaction hashes

None. There are no deployed escrow IDs, submitted transaction hashes, player deposits, gross settlement amounts or net recipient receipts from this run.

## F. One escrow per game

Consistent with documented multi-depositor funding. Not empirically demonstrated yet.

## G. Refund viability

80% gross allocation and 100% gross allocation are represented by the harness workflows. Net amounts, fees and subsidy requirements remain unverified. The literal 100% net scenario must be calculated after measuring real deductions, using a fresh escrow if an earlier one has already resolved.

## H. Next step

Ask Trustless Work/the mentor to add the EURC trustline to their Testnet protocol-fee account `GA6KH5VWPCHBOEF63X57SPX6T4H366YFFKKGCVDBTXT2N7JVL6PJCK7G`, for issuer `GB3Q6QDZYTHWT7E5PVS3W7FUT5GVAFC5KSZFFLPU25GO7VTC3NM2ZTVO` and asset code `EURC`. Alternatively they must correct the API's configured fee recipient. Do not redirect protocol fees, substitute another asset, or attempt to obtain that account's private key.

Current required mapping: organizer/operator = service provider/receiver/approver/release signer/platform; separate GameLock admin; separate resolver; Player 1 and Player 2 = depositors only. Player refund requests/entitlements are recorded in the application. At final settlement the operator opens the dispute, and the resolver distributes approved refunds and remaining organizer proceeds. No player has dispute-opening or resolution authority. The harness enforces this restriction.

Dedicated admin and resolver addresses are supplied and funded. No deployment was retried during this role-account check. After the upstream protocol-fee trustline/configuration is confirmed fixed, retry the unsigned deployment build and stop for the GameLock admin Freighter signature. Finish the spike before changing GameLock's provider or database.
