# GameLock — six-slide pitch outline

## 1. A full chat is not a full team

- Pickup games organize in WhatsApp.
- An RSVP carries no financial commitment.
- Late cancellations leave organizers paying venue costs.
- Incomplete teams reduce game quality.

**Suggested visual:** An illustrative group-chat RSVP list beside a half-empty basketball court.

**Speaker note:** “The organizer books the court, but the players' commitment is only a message. GameLock makes that commitment tangible.”

## 2. Commit to the game

- Discover a game and reserve a spot.
- Pay in advance through Freighter.
- Confirm the booking only after verified payment.
- Apply clear, configurable cancellation policies.

**Suggested visual:** Existing game-details and confirmed-booking screenshots.

**Speaker note:** “Players get a clear booking journey and refund policy. Organizers see who has actually paid.”

## 3. From 7 EURC payment to 5.6 EURC refund

- Player signs 7 EURC on Stellar Testnet.
- Server verifies the receipt and confirms the booking.
- Early cancellation creates an 80% refund obligation.
- Organizer signs 5.6 EURC back to the player.
- GameLock verifies completion and protects against duplicate refunds.

**Suggested visual:** Five-step journey with the two verified transaction links from the README.

**Speaker note:** “Both transfers completed end-to-end. Native funds go directly to the organizer, and the organizer signs the refund. This is the working demo, not an escrow claim.”

## 4. Stellar payments with independent verification

- React/TypeScript on a Lovable-generated foundation.
- Domain rules and Lovable Cloud/Supabase persistence.
- Server-side PaymentProvider abstraction.
- Freighter signing and Horizon Testnet verification.
- Separate Trustless Work/Soroban escrow preparation.

**Suggested visual:** Simplified README architecture diagram, with the future escrow path shown separately.

**Speaker note:** “Stellar provides low-cost EURC transfers and transparent settlement. Wallets sign; our server verifies the receipt before persisting a booking or refund. We store no private keys.”

## 5. Start with recurring sports communities

- Initial users: basketball organizers and players in Lisbon.
- Proposed per-booking fee: 5–8% or a fixed fee.
- Validate pricing and repeat usage with organizers.
- Configurable pricing and cancellation policies.
- Expand into other recreational sports and cities.

**Suggested visual:** Illustrative 7 EURC booking economics: a proposed 5–8% fee equals €0.35–€0.56, clearly labelled as a future model.

**Speaker note:** “We start with a focused community and recurring bookings. Platform-fee collection is proposed, not demonstrated; pricing and market demand still need validation.”

## 6. Working today, clear next steps

- Booking, organizer dashboard, verified payment, and verified 80% refund.
- 99 passing tests; type-check and production build pass.
- Trustless Work V2 beta spike isolated an upstream protocol-fee trustline blocker.
- Next: production auth, mobile wallet UX, notifications, and automated settlement/escrow.
- Mainnet after production and compliance hardening; expand sports and cities.

**Suggested visual:** Two columns: “Verified Testnet MVP” with receipt evidence, and “Roadmap” with three milestones.

**Speaker note:** “The native Stellar demo is complete. The escrow spike found a provider-controlled EURC trustline prerequisite, so we kept the working payment flow separate. This remains a supervised Testnet MVP, with organizer-signed refunds and no production authentication.”
