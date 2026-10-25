INSERT INTO public.games (id, title, sport, country, city, venue, venue_address, venue_maps_url, time_zone, date, start_time, end_time, starts_at, ends_at, currency, price_per_player, minimum_players, maximum_players, confirmation_deadline, cancellation_cutoff_hours, refund_percentage, refund_percentage_after_cutoff, refund_percentage_on_game_cancelled, organizer_fee_percentage, what_to_bring, status) VALUES
('pickup-lisbon-thu', 'Pickup Basketball Lisbon', 'Basketball', 'PT', 'Lisbon', 'INATEL', 'Av. Rio de Janeiro, 1700-330 Lisboa', 'https://www.google.com/maps/search/?api=1&query=INATEL+Lisboa+Parque+de+Jogos', 'Europe/Lisbon', '2026-10-29', '20:00', '22:00', '2026-10-29T20:00:00Z', '2026-10-29T22:00:00Z', 'EUR', 700, 10, 15, '2026-10-29T12:00:00Z', 4, 80, 0, 100, 0, ARRAY['Water','Reversible light/dark jersey','Basketball optional'], 'confirmed'),
('pickup-lisbon-fri', 'Friday Pickup Basketball', 'Basketball', 'PT', 'Lisbon', 'Pavilhão Alvalade', 'R. Alferes Malheiro, 1700-024 Lisboa', 'https://www.google.com/maps/search/?api=1&query=Alvalade+Lisboa+pavilhao', 'Europe/Lisbon', '2026-10-30', '19:00', '21:00', '2026-10-30T19:00:00Z', '2026-10-30T21:00:00Z', 'EUR', 700, 10, 15, '2026-10-30T11:00:00Z', 4, 80, 0, 100, 0, ARRAY['Water','Reversible light/dark jersey','Basketball optional'], 'sold_out'),
('sunday-lisbon', 'Sunday Basketball Lisbon', 'Basketball', 'PT', 'Lisbon', 'INATEL', 'Av. Rio de Janeiro, 1700-330 Lisboa', 'https://www.google.com/maps/search/?api=1&query=INATEL+Lisboa+Parque+de+Jogos', 'Europe/Lisbon', '2026-11-01', '10:00', '12:00', '2026-11-01T10:00:00Z', '2026-11-01T12:00:00Z', 'EUR', 700, 10, 15, '2026-10-31T20:00:00Z', 4, 80, 0, 100, 0, ARRAY['Water','Reversible light/dark jersey','Basketball optional'], 'pending');

INSERT INTO public.players (id, first_name, last_name)
SELECT ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid, split_part(name, ' ', 1), split_part(name, ' ', 2)
FROM unnest(ARRAY['Alex Martin','Marco Silva','Tiago Costa','Inês Rocha','Diogo Pereira','Lucas Moreau','Rafael Gomes','Ben Carter','João Santos','Miguel Alves','Pedro Nunes','Sam Okafor','Hugo Ferreira','Ana Ribeiro','Daniel Kim']) WITH ORDINALITY AS t(name, n);

INSERT INTO public.bookings (id, game_id, player_id, status, spots, amount, currency, created_at)
SELECT ('10000000-0000-4000-8000-' || lpad((g.idx * 100 + i)::text, 12, '0'))::uuid, g.id,
       ('00000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid, 'confirmed', 1, 700, 'EUR', '2026-10-20T10:00:00Z'
FROM (VALUES ('pickup-lisbon-thu', 0, 12), ('pickup-lisbon-fri', 1, 15), ('sunday-lisbon', 2, 7)) AS g(id, idx, cnt)
CROSS JOIN LATERAL generate_series(1, g.cnt) AS i;

INSERT INTO public.payments (booking_id, amount, currency, status, provider, external_reference, created_at)
SELECT b.id, b.amount, b.currency, 'successful', 'mock', 'seed_' || b.id::text, b.created_at
FROM public.bookings b;