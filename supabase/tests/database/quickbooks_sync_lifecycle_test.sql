-- pgTAP: sync-run manifest + snapshot lifecycle hardening.
-- The sync pipeline records a per-request results manifest and richer
-- lifecycle states; these assertions pin the schema contract.
begin;
select plan(4);

select has_column('public', 'quickbooks_sync_runs', 'results',
  'sync runs carry the per-request results manifest');

select ok(
  (select data_type = 'jsonb' from information_schema.columns
    where table_schema = 'public' and table_name = 'quickbooks_sync_runs'
      and column_name = 'results'),
  'results manifest is jsonb'
);

select has_column('public', 'quickbooks_report_snapshots', 'status',
  'snapshots carry a lifecycle status');

-- Status must remain unconstrained text so new lifecycle states
-- (ready/validated/empty_source/persistence_failed/validation_failed/…)
-- never require a migration to adopt.
select ok(
  not exists (
    select 1 from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public' and t.relname = 'quickbooks_report_snapshots'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%status%'
  ),
  'snapshot status has no CHECK constraint blocking new lifecycle states'
);

select finish();
rollback;
