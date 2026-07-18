-- =========================================
-- 1) Auto-create profile on new auth user
-- =========================================
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meta_role text;
  meta_full_name text;
  resolved_role text;
BEGIN
  meta_role := NULLIF(NEW.raw_user_meta_data ->> 'role', '');
  meta_full_name := NULLIF(NEW.raw_user_meta_data ->> 'full_name', '');
  resolved_role := CASE WHEN meta_role IN ('seller','buyer') THEN meta_role ELSE 'seller' END;

  INSERT INTO public.profiles (id, email, role, full_name)
  VALUES (NEW.id, NEW.email, resolved_role, meta_full_name)
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        role = COALESCE(public.profiles.role, EXCLUDED.role),
        full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name);

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- Backfill missing profiles for existing users
INSERT INTO public.profiles (id, email, role, full_name)
SELECT u.id,
       u.email,
       COALESCE(NULLIF(u.raw_user_meta_data ->> 'role',''), 'seller'),
       NULLIF(u.raw_user_meta_data ->> 'full_name','')
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- =========================================
-- 2) QuickBooks connections
-- =========================================
CREATE TABLE public.quickbooks_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE,
  realm_id text NOT NULL,
  environment text NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox','production')),
  company_name text,
  scope text,
  token_secret_id uuid,
  status text NOT NULL DEFAULT 'connected' CHECK (status IN ('connected','expired','disconnected','error')),
  connected_at timestamptz DEFAULT now(),
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX quickbooks_connections_active_seller_realm
  ON public.quickbooks_connections (seller_id, realm_id)
  WHERE status <> 'disconnected';

GRANT SELECT ON public.quickbooks_connections TO authenticated;
GRANT ALL ON public.quickbooks_connections TO service_role;

ALTER TABLE public.quickbooks_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sellers read own QB connection metadata"
  ON public.quickbooks_connections FOR SELECT
  TO authenticated
  USING (seller_id = auth.uid());

CREATE TRIGGER update_qb_connections_updated_at
  BEFORE UPDATE ON public.quickbooks_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- 3) QuickBooks OAuth state (server-only)
-- =========================================
CREATE TABLE public.quickbooks_oauth_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE,
  state_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.quickbooks_oauth_states TO service_role;
-- Intentionally NO grants to anon/authenticated: only edge functions touch this table.

ALTER TABLE public.quickbooks_oauth_states ENABLE ROW LEVEL SECURITY;
-- No policies = no rows visible to anon/authenticated even if grants were added later.

-- =========================================
-- 4) QuickBooks report snapshots
-- =========================================
CREATE TABLE public.quickbooks_report_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.quickbooks_connections(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  report_type text NOT NULL CHECK (report_type IN ('profit_and_loss','balance_sheet','company_info')),
  period_start date,
  period_end date,
  accounting_method text,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  normalized_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  fetched_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.quickbooks_report_snapshots TO authenticated;
GRANT ALL ON public.quickbooks_report_snapshots TO service_role;

ALTER TABLE public.quickbooks_report_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sellers read QB snapshots for own business"
  ON public.quickbooks_report_snapshots FOR SELECT
  TO authenticated
  USING (public.owns_business(business_id));

CREATE INDEX quickbooks_report_snapshots_biz_type_idx
  ON public.quickbooks_report_snapshots (business_id, report_type, fetched_at DESC);
