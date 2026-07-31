-- pgTAP: RLS exposure for the quickbooks_* tables.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(10);

-- OAuth state table is server-only: no Data API access at all.
SELECT ok(NOT has_table_privilege('anon', 'public.quickbooks_oauth_states', 'SELECT'), 'anon cannot read oauth states');
SELECT ok(NOT has_table_privilege('authenticated', 'public.quickbooks_oauth_states', 'SELECT'), 'authenticated cannot read oauth states');
SELECT ok(NOT has_table_privilege('authenticated', 'public.quickbooks_oauth_states', 'INSERT'), 'authenticated cannot write oauth states');

-- RLS is enabled on every quickbooks table.
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.quickbooks_connections'::regclass),
  'RLS enabled on quickbooks_connections');
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.quickbooks_report_snapshots'::regclass),
  'RLS enabled on quickbooks_report_snapshots');
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.quickbooks_oauth_states'::regclass),
  'RLS enabled on quickbooks_oauth_states');

-- Anonymous visitors have no read path to connection or snapshot data.
SELECT ok(NOT has_table_privilege('anon', 'public.quickbooks_connections', 'SELECT'), 'anon cannot read connections');
SELECT ok(NOT has_table_privilege('anon', 'public.quickbooks_report_snapshots', 'SELECT'), 'anon cannot read snapshots');

-- Signed-in users must not be able to forge connection metadata directly;
-- every policy on quickbooks_connections is owner-scoped on seller_id.
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'quickbooks_connections'
      AND cmd IN ('INSERT', 'UPDATE', 'ALL')
      AND coalesce(with_check, qual, '') NOT LIKE '%seller_id%'
  ),
  'every write policy on quickbooks_connections is scoped to seller_id');

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN ('quickbooks_connections','quickbooks_report_snapshots')
      AND 'anon' = ANY(roles)
  ),
  'no quickbooks policy targets the anon role (buyers/visitors excluded)');

SELECT * FROM finish();
ROLLBACK;
