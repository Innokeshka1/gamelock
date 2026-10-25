# GameLock — database connection

- [x] Database schema (games, players, bookings, payments, refunds) + demo seed data
- [x] Align domain statuses with the database (confirmed/pending/cancelled/refunded, completed games)
- [x] Server-side data layer (`src/domain/data/`) — queries and mutations
- [x] Store backed by the database (same API, UI unchanged)
- [x] Root loader primes the store; game metadata from the database
- [x] Organizer: Create Game form
- [x] Tests pass
- [x] Verified end-to-end: book → pay → cancel with refund → create game; test data cleaned up
