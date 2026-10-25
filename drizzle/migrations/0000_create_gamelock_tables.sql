CREATE TYPE public.game_status AS ENUM ('pending', 'confirmed', 'sold_out', 'cancelled', 'completed');
CREATE TYPE public.booking_status AS ENUM ('pending', 'confirmed', 'cancelled', 'refunded');
CREATE TYPE public.payment_status AS ENUM ('pending', 'successful', 'failed', 'refund_pending', 'refunded');
CREATE TYPE public.refund_status AS ENUM ('pending', 'completed', 'failed');

CREATE TABLE public.games (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  sport TEXT NOT NULL,
  country TEXT NOT NULL,
  city TEXT NOT NULL,
  venue TEXT NOT NULL,
  venue_address TEXT NOT NULL DEFAULT '',
  venue_maps_url TEXT NOT NULL DEFAULT '',
  time_zone TEXT NOT NULL DEFAULT 'UTC',
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  currency TEXT NOT NULL,
  price_per_player INTEGER NOT NULL,
  minimum_players INTEGER NOT NULL,
  maximum_players INTEGER NOT NULL,
  confirmation_deadline TIMESTAMPTZ NOT NULL,
  cancellation_cutoff_hours INTEGER NOT NULL DEFAULT 4,
  refund_percentage INTEGER NOT NULL DEFAULT 100,
  refund_percentage_after_cutoff INTEGER NOT NULL DEFAULT 0,
  refund_percentage_on_game_cancelled INTEGER NOT NULL DEFAULT 100,
  organizer_fee_percentage INTEGER NOT NULL DEFAULT 0,
  what_to_bring TEXT[] NOT NULL DEFAULT '{}',
  status public.game_status NOT NULL DEFAULT 'pending',
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id TEXT NOT NULL REFERENCES public.games(id),
  player_id UUID NOT NULL REFERENCES public.players(id),
  status public.booking_status NOT NULL DEFAULT 'pending',
  spots INTEGER NOT NULL DEFAULT 1,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  cancelled_at TIMESTAMPTZ
);

CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL UNIQUE REFERENCES public.bookings(id),
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL,
  status public.payment_status NOT NULL DEFAULT 'pending',
  provider TEXT NOT NULL DEFAULT 'mock',
  external_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES public.payments(id),
  amount INTEGER NOT NULL,
  status public.refund_status NOT NULL DEFAULT 'pending',
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_bookings_game_id ON public.bookings(game_id);
CREATE INDEX idx_bookings_player_id ON public.bookings(player_id);
CREATE INDEX idx_payments_booking_id ON public.payments(booking_id);
CREATE INDEX idx_refunds_payment_id ON public.refunds(payment_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.games TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.players TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookings TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.refunds TO anon, authenticated;
GRANT ALL ON public.games TO service_role;
GRANT ALL ON public.players TO service_role;
GRANT ALL ON public.bookings TO service_role;
GRANT ALL ON public.payments TO service_role;
GRANT ALL ON public.refunds TO service_role;

ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public full access to games" ON public.games FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public full access to players" ON public.players FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public full access to bookings" ON public.bookings FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public full access to payments" ON public.payments FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public full access to refunds" ON public.refunds FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);