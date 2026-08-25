-- pgTAP: Phase D financial truth layer boundaries.
-- quickbooks_sync_runs and quickbooks_report_snapshots must be seller-only,
-- immutable from the Data API, and invisible to anon/buyers.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(12);

-- RLS enabled on the new + extended tables.
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.quickbooks_sync_runs'::regclass),
  'RLS enabled on quickbooks_sync_runs');

-- Anonymous visitors have no privileges at all on the sync layer.
SELECT ok(NOT has_table_privilege('anon', 'public.quickbooks_sync_runs', 'SELECT'), 'anon cannot read sync runs');
SELECT ok(NOT has_table_privilege('anon', 'public.quickbooks_sync_runs', 'INSERT'), 'anon cannot write sync runs');
SELECT ok(NOT has_table_privilege('anon', 'public.quickbooks_report_snapshots', 'SELECT'), 'anon cannot read snapshots');
SELECT ok(NOT has_table_privilege('anon', 'public.quickbooks_report_snapshots', 'INSERT'), 'anon cannot write snapshots');

-- Signed-in users (buyers included) can never write the sync layer directly;
-- only the server-side sync (service role) creates runs and snapshots.
SELECT ok(NOT has_table_privilege('authenticated', 'public.quickbooks_sync_runs', 'INSERT'), 'authenticated cannot insert sync runs');
SELECT ok(NOT has_table_privilege('authenticated', 'public.quickbooks_sync_runs', 'UPDATE'), 'authenticated cannot update sync runs');
SELECT ok(NOT has_table_privilege('authenticated', 'public.quickbooks_sync_runs', 'DELETE'), 'authenticated cannot delete sync runs');
SELECT ok(NOT has_table_privilege('authenticated', 'public.quickbooks_report_snapshots', 'INSERT'), 'authenticated cannot insert snapshots');
SELECT ok(NOT has_table_privilege('authenticated', 'public.quickbooks_report_snapshots', 'UPDATE'), 'snapshots immutable: no authenticated update');
SELECT ok(NOT has_table_privilege('authenticated', 'public.quickbooks_report_snapshots', 'DELETE'), 'snapshots immutable: no authenticated delete');

-- Every read policy on the sync layer is owner-scoped (seller_id / owns_business).
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('quickbooks_sync_runs', 'quickbooks_report_snapshots')
      AND coalesce(qual, '') NOT LIKE '%seller_id%'
      AND coalesce(qual, '') NOT LIKE '%owns_business%'
  ),
  'every read policy on the sync layer is owner-scoped');

SELECT * FROM finish();
ROLLBACK;
