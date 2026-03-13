-- Ensure demo_leads exists
CREATE TABLE IF NOT EXISTS public.demo_leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  consent BOOLEAN NOT NULL DEFAULT false,
  source TEXT,
  user_agent TEXT,
  referrer TEXT
);

ALTER TABLE public.demo_leads ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'demo_leads' AND policyname = 'demo_leads_deny_select'
  ) THEN
    CREATE POLICY demo_leads_deny_select ON public.demo_leads FOR SELECT USING (false);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'demo_leads' AND policyname = 'demo_leads_deny_insert'
  ) THEN
    CREATE POLICY demo_leads_deny_insert ON public.demo_leads FOR INSERT WITH CHECK (false);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'demo_leads' AND policyname = 'demo_leads_deny_update'
  ) THEN
    CREATE POLICY demo_leads_deny_update ON public.demo_leads FOR UPDATE USING (false);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'demo_leads' AND policyname = 'demo_leads_deny_delete'
  ) THEN
    CREATE POLICY demo_leads_deny_delete ON public.demo_leads FOR DELETE USING (false);
  END IF;
END $$;
