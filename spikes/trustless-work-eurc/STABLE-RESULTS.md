# Stable V1 / Stellar Testnet compatibility

Run: 2026-10-26T00:58:37Z. No signing, submission, UI/database modification, commit or push.

## A. Existing credential

`POST https://dev.api.trustlesswork.com/deployer/single-release` returned HTTP **401 Unauthorized**, using the existing credential through `x-api-key`. The key was neither printed nor persisted. This proves the credential did not authorize this stable deployment request; it does not establish whether the key is beta-only, expired, or otherwise restricted. The public Swagger schema was accessible, which is not an authenticated success.

## B. EURC deployment

No unsigned transaction returned. No escrow deployed. Asset compatibility on stable remains untested because authentication failed first. Fresh Horizon, SDK derivation and Soroban read-only simulations verified:

- Network: `Test SDF Network ; September 2015`.
- Symbol: EURC; decimals: 7.
- Issuer: `GB3Q6QDZYTHWT7E5PVS3W7FUT5GVAFC5KSZFFLPU25GO7VTC3NM2ZTVO`.
- Token: `CCUUDM434BMZMYWYDITHFXHDMIVTGGD6T2I5UKNX5BSLXLW7HVR4MCGZ`.
- Receiver's EURC trustline/account readiness passed.

Requested configuration: one isolated test game, one single-release escrow, amount **14 EURC** (140000000 atomic units), two intended 7 EURC deposits, one milestone, platformFee 0. No real game record was created or modified.

## Exact role mapping attempted

| V1 field | Existing wallet |
|---|---|
| signer; platformAddress (update authority) | Admin `GC6AZBSQGDHSXSNYLVGYN7PLDHVR2XO5TYOL7VLJ62I2HS5UWSUKLYBX` |
| approver; releaseSigner | Operator `GDBZY43YA2WNTSGUB5VW3ZZE5VEGRNI5H3ZKDVFIITL3ZXUXAPOGWRV6` |
| serviceProvider; receiver | Organizer, same configured address as operator |
| disputeResolver | Resolver `GDGT4GOHSABEPB5JFOX6HWBUGXWLJEWGAD4QBULUXS4YXKH2L5YV5K6P` |
| No role | Existing playerA and playerB wallets, depositors only |

V1 combines update authority and platform-fee destination. Mapping platformAddress to the existing admin preserves separate admin/operator/resolver authority, but changes the fee destination from the configured V2 platform/operator wallet. Fee is zero in this probe; do not enable a fee under this mapping without reviewing it. Admin previously had no EURC trustline; stable validation and fee-transfer behavior remain untested. V1 cannot represent V2's independent admin and fee-only platform roles exactly. Operator is the intended dispute initiator through its approver/releaseSigner roles. This is not a claim that operator is the only address the V1 contract permits to dispute.

If a later authorized retry produces an inspected deployment XDR, the intended signer is the admin above. Signing and subsequent submission would authorize deployment/initialization with these roles and configuration plus XLM network fees, not player deposits or settlement. This run produced no XDR to authorize or inspect.

## C. V1 versus V2 beta

| Concern | Stable V1 | Existing V2 beta spike |
|---|---|---|
| Base | dev.api.trustlesswork.com | beta.api.trustlesswork.com |
| Deployment | /deployer/single-release | /escrow/single-release/v2/deploy |
| Funding | /escrow/single-release/fund-escrow | /escrow/single-release/v2/fund |
| Dispute | /escrow/single-release/dispute-escrow; contractId, signer | /escrow/single-release/v2/dispute; adds reason |
| Resolution | /escrow/single-release/resolve-dispute | /escrow/single-release/v2/resolve-dispute |
| Submission | /helper/send-transaction; signedXdr | /stellar/send-transaction |
| Build response | unsignedTransaction | unsignedXdr, txHash, predicted contractId expected by current harness |
| Token input | trustline: {address: issuer, symbol: EURC} | trustline: {contractId: token} |
| Authority roles | Singular approver/serviceProvider/releaseSigner/disputeResolver | Arrays approvers/serviceProviders/releaseSigners/disputeResolvers |
| Admin/platform | platformAddress combines administration/fees | Separate admin and platform |
| Milestone deployment | description only | description and approvalsTarget: 1 |
| Approval/state | Single approver, boolean approval; flags object | Threshold approvals; direct state fields |

The stable deployed Swagger confirms all five requested endpoints. Funding, dispute, resolution and submission were **not called**: no deployed contract exists and signing/submission are outside this test. V1 resolution schema requires positive distributions totaling current balance; this remains whole-game terminal settlement rather than an independently settled refund for every cancellation. Actual EURC fee deductions, protocol-fee trustline compatibility and net refunds are unverified. No claim that the V2 fee-wallet blocker is absent in V1.

One escrow per game must be enforced by GameLock's durable mapping/idempotency; an engagementId is not proof of global uniqueness. Players can fund without roles. Preserve atomic integer accounting internally and carefully convert to numeric API amounts at the adapter boundary.

Source discrepancy: the local skill's V1 profile mentions versioned routes; the deployed stable Swagger and official API introduction document the unversioned routes used here. Swagger's nested role/trustline schema types also disagree with its object examples, and its deploy example misspells trustline. The request follows the official object payload with correctly spelled trustline; authentication failure does not validate that payload.

## D. Provider abstraction

Architecturally feasible with version-specific adapters, not a base-URL switch. PaymentProvider is version-neutral but exposes only payment operations, not the complete game escrow lifecycle. Existing TrustlessWorkProvider is explicitly preparation-only; live methods throw. Config pins the beta URL; GameEscrow.protocol is the literal v2-beta. Supporting both needs a protocol discriminator, versioned role/payload/response adapters, configuration changes, signing transport, durable game-to-escrow/payment-attempt mapping and independent chain reconciliation. Existing settlement/atomic-money logic can be reused; fee quotes must reflect the selected deployment. No provider implementation was changed.

## E. Hackathon decision

**Candidate fallback, not currently validated or usable with this credential.** First obtain/enable stable Testnet deployment access, then repeat the unsigned probe and stop for review. Even a successful build would not prove funding or EURC refunds. Before calling it operational, separately authorize and verify deployment, two player deposits, operator dispute, resolver settlement and exact recipient/net-fee transfers. Keep the main app on mock until integration is actually complete.

Evidence: ignored `artifacts/stable-v1-compat.json` contains timestamp, request, asset verification and exact 401 response. Reproduction script: `stable-compat.mjs` (build-only, no signer/submission code). No transaction IDs or hashes were produced.

Sources: [deployed stable OpenAPI](https://dev.api.trustlesswork.com/docs-json), [official API introduction](https://docs.trustlesswork.com/trustless-work/api-rest/introduction), [official roles](https://docs.trustlesswork.com/trustless-work/introduction/technology-overview/roles-in-trustless-work). V2 comparison uses the existing spike and local version-specific skill profile; no V2 mutation was attempted.
