# GameLock — 105-second demo

## Before recording

Run the README startup command. Use a Freighter-enabled browser on Testnet, unlock the two demo wallets, and keep the README transaction links ready. Choose an available 7 EURC game with more than four hours until start and an open booking deadline. Check balances and the exact issuer. Keep the organizer dashboard open in a second tab. Never show wallet recovery information or `.env`.

Use a fresh booking for a fresh transfer. The completed example is `/bookings/5f44e6da-14d4-4d43-a47a-9fd05ba35d43`; use it as recorded evidence, not as a payable booking. Record the complete flow first, then trim waiting time to meet the timing below without implying instant confirmation. If the network stalls, show the existing verified receipts and explicitly identify them as the completed demonstration.

| Time | Exact screen actions | Narration |
| --- | --- | --- |
| 0:00–0:10 · Problem | Show the game list and a game's venue/price. | “Pickup games fill in WhatsApp. Then players cancel late, the organizer still pays the venue, and everyone gets a worse game.” |
| 0:10–0:25 · Product | Open the available €7 game. Show available spots, game details, and cancellation policy; open its booking form. | “GameLock turns interest into commitment. Find a game, reserve a spot, and pay in advance. Players see the cancellation rules before paying; organizers manage the roster and payments in one dashboard.” |
| 0:25–0:55 · Booking/payment | Enter Player 1's booking details and submit. On checkout select **Pay with Freighter**. Connect Player 1 on Testnet. Review 7 EURC, exact issuer, and Organizer destination; sign once. Wait for the confirmed booking. | “Player 1 reserves a seven-euro spot and signs a seven-EURC Testnet payment in Freighter. Funds go directly to the organizer. GameLock never holds the private key. Signing alone does not confirm the booking: our server verifies the actual transaction before updating the booking.” |
| 0:55–1:15 · Verified transaction | Click **View verified Stellar transaction**. Show Testnet success, 7 EURC payment operation, sender, receiver, and hash. Return to the booking and refresh. | “Here is the payment on Stellar Testnet. GameLock checks success, ledger inclusion, sender, recipient, asset, amount, and the booking memo. The confirmed booking and receipt survive a refresh because the verified result is persisted.” |
| 1:15–1:35 · Refund | Click **Cancel booking**, show the 80% quote, and confirm. Switch Freighter to Organizer. In `/organizer`, choose the same game and cancelled player; click **Review EURC refund**, then **Sign refund with Freighter**. Review and sign 5.6 EURC to Player 1. Show **Verified refund** after completion. | “An early cancellation returns eighty percent: five-point-six EURC. The organizer reviews and signs the refund. GameLock independently verifies that reverse transfer before marking it complete, with duplicate refund protection.” |
| 1:35–1:45 · Architecture/roadmap | Show the README architecture diagram and both transaction links. | “React, persistent bookings, and a server-side provider power today's native Stellar demo. Next: production authentication, mobile wallet UX, and Trustless Work escrow once its upstream beta blocker is resolved.” |

Do not request another payment or refund to fill a recording gap. If submission is uncertain, reconcile the same booking/refund before signing again. A fresh recording produces fresh hashes; the README links remain evidence of the original completed demo.
