# Native EURC refund MVP

Supersedes the earlier native-payment documentation's statement that refunds are unavailable. Payment creation/signing/verification remains unchanged. Trustless Work remains intact. No schema migration, keys, authentication, scheduler, or automatic signing added.

## Operator flow

1. A confirmed native booking is cancelled from its existing booking page. The server verifies the original receipt and freezes the game-policy quote at cancellation request time: more than four hours gives 80% (700 → 560 minor units); four hours or less gives 0. Policy values come from the game configuration.
2. Organizer game cancellation queues 100% for its confirmed paid bookings (700 → 700 for the configured game). Unreconciled prepared native payments block game cancellation. Existing mock bookings remain simulated. Resume cancellation repairs an interrupted game cancellation.
3. In `/organizer`, select the Organizer wallet in Freighter on Testnet, then click **Review EURC refund** on the cancelled player. This connects the wallet and prepares, but does not sign. A separate review shows original hash, original payer, Organizer, exact amount and issuer.
4. **Sign refund with Freighter** is the separate signing/submission action. Process one refund at a time: all use the Organizer's account sequence. Inspect one EURC payment to the original payer, amount 5.6000000 for the demo, and the XLM fee.
5. Completion requires an independent successful Horizon receipt with matching hash, ledger, transaction body, sender, recipient, asset, amount and refund-specific memo. Only then is payment/refund marked refunded/completed, and the transaction link displayed.

Zero refunds cancel the booking and record a zero completed refund entitlement without signing, transferring funds, or marking the original payment refunded. No XLM fee is deducted from the EURC refund amount.

## Persistence and retry

`payments.external_reference` becomes a versioned JSON refund record retaining `paymentHash`, original `payer`, integer `amount`, `reason`, `requestedAt`, optional serialized unsigned `intent`, and verified `refundHash`. The app snapshot exposes the original payment hash and completed refund hash, never unsigned XDR. The existing refunds table uses the payment UUID as the refund row's primary key; conflict-ignore upsert makes repair idempotent without a new unique constraint.

Cancellation and intent persistence use compare-and-set against the existing payment reference/status. Only the winning preparation returns an XDR; retries reuse it. The memo includes a refund namespace, payment ID and original hash. No endpoint accepts an arbitrary recipient or refund amount. Completed intents are retained so a lost response or interrupted DB update can be reconciled without another transfer.

On timeout, rejection or interrupted response, use **Review EURC refund** on this same row. The server checks its saved hash before asking for a signature. Do not send manually or create a second refund. An unexpired saved transaction can be signed/submitted again; its fixed hash/sequence cannot execute twice. Expired/failed saved intents are deliberately not automatically replaced: stop for operator chain reconciliation. The five-minute window starts on Review, not cancellation. Restart/re-enable native mode for reconciliation if the provider was changed.

## Demo handoff, 26 October 2026

- Booking: `5f44e6da-14d4-4d43-a47a-9fd05ba35d43`, Player 1, Pickup Basketball Lisbon.
- Original verified payment: `39923d44a1026d8ba8e1bf88735979443cc4b3465eee4e45e432fac2a1edd538`.
- Original payer/refund recipient: `GCE3TFBA33BOWCSYL5GHRPKGTHFTZ5G2EKK5AUZBQGZME5WFVNBLFCVG`.
- Organizer/refund sender: `GDBZY43YA2WNTSGUB5VW3ZZE5VEGRNI5H3ZKDVFIITL3ZXUXAPOGWRV6`.
- Amount: **5.6000000 EURC**, Testnet, seven decimals.
- Issuer: `GB3Q6QDZYTHWT7E5PVS3W7FUT5GVAFC5KSZFFLPU25GO7VTC3NM2ZTVO`.
- Associated asset contract: `CCUUDM434BMZMYWYDITHFXHDMIVTGGD6T2I5UKNX5BSLXLW7HVR4MCGZ`; this refund is a classic Stellar payment, not a contract invocation.
- Booking cancellation was manually verified: €5.60 refund pending, original receipt link preserved, Organizer review action visible. No real refund signature or submission was requested. A read-only unsigned preflight checks readiness; Review creates a fresh persisted intent when the Organizer is ready.
- 99 tests passed; type-check and production build passed. Tests include exact reverse transfer/memo, invalid original receipt, wrong signer, duplicate/CAS handling, 80/100/0% policies, unverified submission, expiry, interrupted completion and separate UI review/sign actions.

## Limits

This remains a supervised Testnet MVP with the existing public database. Direct database tampering is not prevented by application checks; no production authorization claim is made. Organizers must sign each refund themselves. There is no refund scheduler, batch signing, automatic expired-intent replacement, or Trustless Work escrow settlement. Native game cancellation can be retried after partial writes but is not a multi-row database transaction.

Receipt validation follows the [official Horizon transaction fields](https://developers.stellar.org/docs/data/apis/horizon/api-reference/resources/transactions/object). Stellar payment and Freighter modules used for the working deposit path are unchanged.
