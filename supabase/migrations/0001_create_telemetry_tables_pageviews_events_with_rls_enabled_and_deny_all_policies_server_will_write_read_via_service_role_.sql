-- Telemetry page views
CREATE TABLE IF NOT EXISTS public.telemetry_pageviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  session_id TEXT NOT NULL,
  user_key TEXT,
  pathname TEXT NOT NULL,
  referrer TEXT,
  user_agent TEXT
);

ALTER TABLE public.telemetry_pageviews ENABLE ROW LEVEL SECURITY;

-- Telemetry events (clicks, durations, custom)
CREATE TABLE IF NOT EXISTS public.telemetry_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  session_id TEXT NOT NULL,
  user_key TEXT,
  event_name TEXT NOT NULL,
  pathname TEXT NOT NULL,
  props JSONB NOT NULL DEFAULT '{}'::jsonb,
  user_agent TEXT
);

ALTER TABLE public.telemetry_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- pageviews deny
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='telemetry_pageviews' AND policyname='telemetry_pageviews_deny_select') THEN
    CREATE POLICY telemetry_pageviews_deny_select ON public.telemetry_pageviews FOR SELECT USING (false);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='telemetry_pageviews' AND policyname='telemetry_pageviews_deny_insert') THEN
    CREATE POLICY telemetry_pageviews_deny_insert ON public.telemetry_pageviews FOR INSERT WITH CHECK (false);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='telemetry_pageviews' AND policyname='telemetry_pageviews_deny_update') THEN
    CREATE POLICY telemetry_pageviews_deny_update ON public.telemetry_pageviews FOR UPDATE USING (false);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='telemetry_pageviews' AND policyname='telemetry_pageviews_deny_delete') THEN
    CREATE POLICY telemetry_pageviews_deny_delete ON public.telemetry_pageviews FOR DELETE USING (false);
  END IF;

  -- events deny
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='telemetry_events' AND policyname='telemetry_events_deny_select') THEN
    CREATE POLICY telemetry_events_deny_select ON public.telemetry_events FOR SELECT USING (false);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='telemetry_events' AND policyname='telemetry_events_deny_insert') THEN
    CREATE POLICY telemetry_events_deny_insert ON public.telemetry_events FOR INSERT WITH CHECK (false);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='telemetry_events' AND policyname='telemetry_events_deny_update') THEN
    CREATE POLICY telemetry_events_deny_update ON public.telemetry_events FOR UPDATE USING (false);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='telemetry_events' AND policyname='telemetry_events_deny_delete') THEN
    CREATE POLICY telemetry_events_deny_delete ON public.telemetry_events FOR DELETE USING (false);
  END IF;
END $$;
