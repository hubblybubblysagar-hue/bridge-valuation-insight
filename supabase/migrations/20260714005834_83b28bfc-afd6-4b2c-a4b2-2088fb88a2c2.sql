
-- Shared updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  role text NOT NULL CHECK (role IN ('seller','buyer','admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- businesses
CREATE TABLE public.businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  business_name text,
  anonymous_title text,
  industry text,
  city text,
  state text,
  region text,
  years_in_business integer,
  employees integer,
  reason_for_sale text,
  desired_timeline text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','valuation_generated','teaser_generated','interest_test_approved','archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.businesses TO authenticated;
GRANT ALL ON public.businesses TO service_role;
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "seller manages own businesses" ON public.businesses FOR ALL TO authenticated
  USING (auth.uid() = seller_id) WITH CHECK (auth.uid() = seller_id);
CREATE TRIGGER trg_businesses_updated BEFORE UPDATE ON public.businesses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Helper: does the current user own this business?
CREATE OR REPLACE FUNCTION public.owns_business(_business_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.businesses WHERE id = _business_id AND seller_id = auth.uid());
$$;

-- seller_financials
CREATE TABLE public.seller_financials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('quickbooks_mock','quickbooks','upload','manual')),
  revenue numeric,
  gross_profit numeric,
  operating_expenses numeric,
  net_income numeric,
  owner_compensation numeric,
  one_time_expenses numeric,
  personal_addbacks numeric,
  other_addbacks numeric,
  estimated_sde numeric,
  period_start date,
  period_end date,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seller_financials TO authenticated;
GRANT ALL ON public.seller_financials TO service_role;
ALTER TABLE public.seller_financials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "seller manages own financials" ON public.seller_financials FOR ALL TO authenticated
  USING (public.owns_business(business_id)) WITH CHECK (public.owns_business(business_id));
CREATE TRIGGER trg_financials_updated BEFORE UPDATE ON public.seller_financials FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- risk_answers
CREATE TABLE public.risk_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_concentration text,
  owner_relationships text,
  transition_support text,
  revenue_type text,
  facility_status text,
  key_employees text,
  book_quality text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.risk_answers TO authenticated;
GRANT ALL ON public.risk_answers TO service_role;
ALTER TABLE public.risk_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "seller manages own risk answers" ON public.risk_answers FOR ALL TO authenticated
  USING (public.owns_business(business_id)) WITH CHECK (public.owns_business(business_id));
CREATE TRIGGER trg_risk_updated BEFORE UPDATE ON public.risk_answers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- valuations
CREATE TABLE public.valuations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  financials_id uuid REFERENCES public.seller_financials(id) ON DELETE SET NULL,
  low_value numeric,
  base_value numeric,
  high_value numeric,
  estimated_sde numeric,
  low_multiple numeric,
  base_multiple numeric,
  high_multiple numeric,
  confidence text CHECK (confidence IN ('Low','Medium','High')),
  value_drivers jsonb NOT NULL DEFAULT '[]'::jsonb,
  buyer_concerns jsonb NOT NULL DEFAULT '[]'::jsonb,
  upside_opportunities jsonb NOT NULL DEFAULT '[]'::jsonb,
  likely_buyer_types jsonb NOT NULL DEFAULT '[]'::jsonb,
  methodology text,
  disclaimer text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.valuations TO authenticated;
GRANT ALL ON public.valuations TO service_role;
ALTER TABLE public.valuations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "seller manages own valuations" ON public.valuations FOR ALL TO authenticated
  USING (public.owns_business(business_id)) WITH CHECK (public.owns_business(business_id));
CREATE TRIGGER trg_valuations_updated BEFORE UPDATE ON public.valuations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- teasers
CREATE TABLE public.teasers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  valuation_id uuid REFERENCES public.valuations(id) ON DELETE SET NULL,
  title text,
  overview text,
  financial_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  investment_highlights jsonb NOT NULL DEFAULT '[]'::jsonb,
  growth_opportunities jsonb NOT NULL DEFAULT '[]'::jsonb,
  transition_profile text,
  buyer_fit text,
  confidentiality_note text,
  approved_for_outreach boolean NOT NULL DEFAULT false,
  share_slug text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teasers TO authenticated;
GRANT ALL ON public.teasers TO service_role;
ALTER TABLE public.teasers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "seller manages own teasers" ON public.teasers FOR ALL TO authenticated
  USING (public.owns_business(business_id)) WITH CHECK (public.owns_business(business_id));
CREATE POLICY "buyers read approved teasers" ON public.teasers FOR SELECT TO authenticated
  USING (approved_for_outreach = true);
CREATE TRIGGER trg_teasers_updated BEFORE UPDATE ON public.teasers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- buyer_profiles
CREATE TABLE public.buyer_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  buyer_type text,
  target_industries text[],
  target_geographies text[],
  target_revenue_min numeric,
  target_revenue_max numeric,
  target_sde_min numeric,
  target_sde_max numeric,
  available_capital numeric,
  timeline_to_acquire text,
  proof_of_funds_status text NOT NULL DEFAULT 'not_verified' CHECK (proof_of_funds_status IN ('not_verified','submitted','verified')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.buyer_profiles TO authenticated;
GRANT ALL ON public.buyer_profiles TO service_role;
ALTER TABLE public.buyer_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "buyer manages own profile" ON public.buyer_profiles FOR ALL TO authenticated
  USING (auth.uid() = buyer_id) WITH CHECK (auth.uid() = buyer_id);
CREATE TRIGGER trg_buyer_profiles_updated BEFORE UPDATE ON public.buyer_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- buyer_interest_tests
CREATE TABLE public.buyer_interest_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  teaser_id uuid REFERENCES public.teasers(id) ON DELETE SET NULL,
  seller_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','queued','sent','paused','completed')),
  matched_buyer_count integer NOT NULL DEFAULT 0,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.buyer_interest_tests TO authenticated;
GRANT ALL ON public.buyer_interest_tests TO service_role;
ALTER TABLE public.buyer_interest_tests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "seller manages own interest tests" ON public.buyer_interest_tests FOR ALL TO authenticated
  USING (auth.uid() = seller_id) WITH CHECK (auth.uid() = seller_id);
CREATE TRIGGER trg_interest_updated BEFORE UPDATE ON public.buyer_interest_tests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- nda_requests
CREATE TABLE public.nda_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teaser_id uuid REFERENCES public.teasers(id) ON DELETE CASCADE,
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE,
  buyer_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  buyer_profile_id uuid REFERENCES public.buyer_profiles(id) ON DELETE SET NULL,
  buyer_name text,
  buyer_email text,
  signature_text text,
  confidentiality_accepted boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','seller_review','approved','denied','expired')),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.nda_requests TO authenticated;
GRANT ALL ON public.nda_requests TO service_role;
ALTER TABLE public.nda_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "buyer inserts own nda" ON public.nda_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY "buyer reads own nda" ON public.nda_requests FOR SELECT TO authenticated
  USING (auth.uid() = buyer_id);
CREATE POLICY "seller reads nda for own business" ON public.nda_requests FOR SELECT TO authenticated
  USING (public.owns_business(business_id));
CREATE POLICY "seller updates nda for own business" ON public.nda_requests FOR UPDATE TO authenticated
  USING (public.owns_business(business_id)) WITH CHECK (public.owns_business(business_id));
CREATE TRIGGER trg_nda_updated BEFORE UPDATE ON public.nda_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- file_uploads
CREATE TABLE public.file_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  uploader_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  file_type text CHECK (file_type IN ('pnl','balance_sheet','tax_return','quickbooks_export','bank_statement','other')),
  storage_bucket text,
  storage_path text,
  original_file_name text,
  mime_type text,
  file_size integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.file_uploads TO authenticated;
GRANT ALL ON public.file_uploads TO service_role;
ALTER TABLE public.file_uploads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "seller manages own files" ON public.file_uploads FOR ALL TO authenticated
  USING (public.owns_business(business_id)) WITH CHECK (public.owns_business(business_id));

-- Storage object policies (buckets created via storage tool)
CREATE POLICY "exitbridge user reads own uploads" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id IN ('financial-uploads','teaser-pdfs') AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "exitbridge user inserts own uploads" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('financial-uploads','teaser-pdfs') AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "exitbridge user updates own uploads" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id IN ('financial-uploads','teaser-pdfs') AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "exitbridge user deletes own uploads" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id IN ('financial-uploads','teaser-pdfs') AND (storage.foldername(name))[1] = auth.uid()::text);
