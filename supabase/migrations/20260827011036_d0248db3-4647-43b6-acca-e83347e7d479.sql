-- 1. The Aug 26 "snapshot_insert_failed" root cause: report_type was pinned to
--    three literal values, so every successfully retrieved Cash Flow, Trial
--    Balance, AR/AP aging and Chart of Accounts payload was rejected at insert.
ALTER TABLE public.quickbooks_report_snapshots
  DROP CONSTRAINT IF EXISTS quickbooks_report_snapshots_report_type_check;

ALTER TABLE public.quickbooks_report_snapshots
  ADD CONSTRAINT quickbooks_report_snapshots_report_type_format
  CHECK (report_type ~ '^[a-z][a-z0-9_]{2,63}$');

-- 2. Source contract columns: describe what was retrieved, not just its rows.
ALTER TABLE public.quickbooks_report_snapshots
  ADD COLUMN IF NOT EXISTS source_key text,
  ADD COLUMN IF NOT EXISTS source_label text,
  ADD COLUMN IF NOT EXISTS request_path text,
  ADD COLUMN IF NOT EXISTS source_kind text,
  ADD COLUMN IF NOT EXISTS availability text,
  ADD COLUMN IF NOT EXISTS privacy_tier text,
  ADD COLUMN IF NOT EXISTS structural_node_count integer,
  ADD COLUMN IF NOT EXISTS financial_row_count integer,
  ADD COLUMN IF NOT EXISTS entity_count integer,
  ADD COLUMN IF NOT EXISTS transaction_count integer,
  ADD COLUMN IF NOT EXISTS parser_version text,
  ADD COLUMN IF NOT EXISTS reports_api_generation text;

ALTER TABLE public.quickbooks_report_snapshots
  DROP CONSTRAINT IF EXISTS quickbooks_report_snapshots_source_kind_check;
ALTER TABLE public.quickbooks_report_snapshots
  ADD CONSTRAINT quickbooks_report_snapshots_source_kind_check
  CHECK (source_kind IS NULL OR source_kind IN (
    'company_metadata', 'financial_report', 'accounting_entity', 'transaction_entity'
  ));

ALTER TABLE public.quickbooks_report_snapshots
  DROP CONSTRAINT IF EXISTS quickbooks_report_snapshots_availability_check;
ALTER TABLE public.quickbooks_report_snapshots
  ADD CONSTRAINT quickbooks_report_snapshots_availability_check
  CHECK (availability IS NULL OR availability IN (
    'ready', 'empty_source', 'source_fault', 'unsupported',
    'not_applicable', 'permission_limited', 'persistence_failed'
  ));

ALTER TABLE public.quickbooks_report_snapshots
  DROP CONSTRAINT IF EXISTS quickbooks_report_snapshots_privacy_tier_check;
ALTER TABLE public.quickbooks_report_snapshots
  ADD CONSTRAINT quickbooks_report_snapshots_privacy_tier_check
  CHECK (privacy_tier IS NULL OR privacy_tier IN (
    'seller_private', 'restricted_diligence', 'derived_confidential', 'buyer_shareable'
  ));

-- 3. Backfill existing immutable snapshots (metadata only; raw payloads and
--    checksums are never rewritten).
UPDATE public.quickbooks_report_snapshots
SET
  source_key = COALESCE(source_key, report_type),
  source_kind = COALESCE(
    source_kind,
    CASE
      WHEN report_type = 'company_info' THEN 'company_metadata'
      WHEN report_type = 'account_list' THEN 'accounting_entity'
      ELSE 'financial_report'
    END
  ),
  privacy_tier = COALESCE(privacy_tier, 'seller_private'),
  availability = COALESCE(
    availability,
    CASE
      WHEN status IN ('ready', 'reconciled', 'validated', 'parsed', 'retrieved', 'synced') THEN 'ready'
      WHEN status = 'empty_source' THEN 'empty_source'
      WHEN status = 'source_fault' THEN 'source_fault'
      WHEN status = 'persistence_failed' THEN 'persistence_failed'
      ELSE NULL
    END
  ),
  financial_row_count = COALESCE(
    financial_row_count,
    NULLIF((normalized_payload ->> 'financial_row_count'), '')::integer
  ),
  parser_version = COALESCE(parser_version, normalized_payload ->> 'parser_version')
WHERE source_key IS NULL OR source_kind IS NULL OR privacy_tier IS NULL;

CREATE INDEX IF NOT EXISTS quickbooks_report_snapshots_source_key_idx
  ON public.quickbooks_report_snapshots (business_id, source_key, period_end DESC);