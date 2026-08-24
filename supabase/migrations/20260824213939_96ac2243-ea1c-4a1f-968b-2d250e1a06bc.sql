-- Phase D: auditable sync runs + snapshot provenance/immutability metadata

CREATE TABLE public.quickbooks_sync_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id uuid NOT NULL REFERENCES public.profiles(id),
  business_id uuid NOT NULL REFERENCES public.businesses(id),
  connection_id uuid NOT NULL REFERENCES public.quickbooks_connections(id),
  status text NOT NULL DEFAULT 'running',
  requested_report_types text[] NOT NULL DEFAULT '{}',
  successful_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  error_codes text[] NOT NULL DEFAULT '{}',
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.quickbooks_sync_runs TO authenticated;
GRANT ALL ON public.quickbooks_sync_runs TO service_role;

ALTER TABLE public.quickbooks_sync_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "seller reads own sync runs"
  ON public.quickbooks_sync_runs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = seller_id);

CREATE TRIGGER update_qb_sync_runs_updated_at
  BEFORE UPDATE ON public.quickbooks_sync_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Snapshot provenance (immutable rows: no UPDATE/DELETE policies or grants exist)
ALTER TABLE public.quickbooks_report_snapshots
  ADD COLUMN IF NOT EXISTS sync_run_id uuid REFERENCES public.quickbooks_sync_runs(id),
  ADD COLUMN IF NOT EXISTS report_basis text,
  ADD COLUMN IF NOT EXISTS source_generated_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS row_count integer,
  ADD COLUMN IF NOT EXISTS checksum text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'synced';

CREATE INDEX IF NOT EXISTS idx_qb_snapshots_business_type
  ON public.quickbooks_report_snapshots (business_id, report_type, fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_qb_snapshots_sync_run
  ON public.quickbooks_report_snapshots (sync_run_id);

COMMENT ON TABLE public.quickbooks_report_snapshots IS
  'Immutable QuickBooks report snapshots. Written only by service_role edge functions; sellers read own via owns_business; buyers/anon have no access.';