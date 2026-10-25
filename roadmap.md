# GameLock → Lovable Database

- [ ] Migration: games, players, bookings, payments, refunds (+ enums, grants, RLS, seed data for 3 demo games)
- [ ] Domain type alignment (booking/payment/refund statuses, "completed" game status)
- [ ] Data layer: server functions + row→domain mappers (src/domain/data/)
- [ ] Store rewrite: same API, backed by database via server functions
- [ ] Routes: root loader primes store; game head meta from DB
- [ ] Organizer: Create Game form (DB-backed)
- [ ] Tests updated + passing; booking flow verified end-to-end
