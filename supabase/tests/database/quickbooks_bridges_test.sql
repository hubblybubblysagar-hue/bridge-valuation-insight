-- pgTAP: QuickBooks Vault bridge permissions + OAuth state security.
-- Run with: supabase test db
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(24);

-- ---------------------------------------------------------------- existence
SELECT has_function('public', 'service_qb_create_token_secret', ARRAY['jsonb','text']);
SELECT has_function('public', 'service_qb_update_token_secret', ARRAY['uuid','jsonb']);
SELECT has_function('public', 'service_qb_get_token_secret', ARRAY['uuid']);
SELECT has_function('public', 'service_qb_delete_token_secret', ARRAY['uuid']);
SELECT has_function('public', 'service_qb_consume_oauth_state', ARRAY['text']);

-- ------------------------------------------------------- anon cannot execute
SELECT ok(NOT has_function_privilege('anon', 'public.service_qb_create_token_secret(jsonb,text)', 'EXECUTE'), 'anon cannot create token secret');
SELECT ok(NOT has_function_privilege('anon', 'public.service_qb_update_token_secret(uuid,jsonb)', 'EXECUTE'), 'anon cannot update token secret');
SELECT ok(NOT has_function_privilege('anon', 'public.service_qb_get_token_secret(uuid)', 'EXECUTE'), 'anon cannot read token secret');
SELECT ok(NOT has_function_privilege('anon', 'public.service_qb_delete_token_secret(uuid)', 'EXECUTE'), 'anon cannot delete token secret');
SELECT ok(NOT has_function_privilege('anon', 'public.service_qb_consume_oauth_state(text)', 'EXECUTE'), 'anon cannot consume oauth state');

-- ---------------------------------------------- authenticated cannot execute
SELECT ok(NOT has_function_privilege('authenticated', 'public.service_qb_create_token_secret(jsonb,text)', 'EXECUTE'), 'authenticated cannot create token secret');
SELECT ok(NOT has_function_privilege('authenticated', 'public.service_qb_update_token_secret(uuid,jsonb)', 'EXECUTE'), 'authenticated cannot update token secret');
SELECT ok(NOT has_function_privilege('authenticated', 'public.service_qb_get_token_secret(uuid)', 'EXECUTE'), 'authenticated cannot read token secret');
SELECT ok(NOT has_function_privilege('authenticated', 'public.service_qb_delete_token_secret(uuid)', 'EXECUTE'), 'authenticated cannot delete token secret');
SELECT ok(NOT has_function_privilege('authenticated', 'public.service_qb_consume_oauth_state(text)', 'EXECUTE'), 'authenticated cannot consume oauth state');

-- --------------------------------------------------- service_role can execute
SELECT ok(has_function_privilege('service_role', 'public.service_qb_get_token_secret(uuid)', 'EXECUTE'), 'service_role can read token secret');
SELECT ok(has_function_privilege('service_role', 'public.service_qb_consume_oauth_state(text)', 'EXECUTE'), 'service_role can consume oauth state');

-- ---------------------------------------------- private schema stays private
SELECT ok(NOT has_schema_privilege('anon', 'private', 'USAGE'), 'anon has no usage on private schema');
SELECT ok(NOT has_schema_privilege('authenticated', 'private', 'USAGE'), 'authenticated has no usage on private schema');

-- --------------------------------------------------- OAuth state lifecycle
SET LOCAL ROLE postgres;
INSERT INTO auth.users (id, email, instance_id, aud, role)
VALUES ('00000000-0000-4000-8000-000000000901', 'pgtap-seller@example.test',
        '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.quickbooks_oauth_states (seller_id, business_id, state_hash, expires_at)
VALUES ('00000000-0000-4000-8000-000000000901', NULL, 'pgtap_fresh_state', now() + interval '10 minutes');

INSERT INTO public.quickbooks_oauth_states (seller_id, business_id, state_hash, expires_at)
VALUES ('00000000-0000-4000-8000-000000000901', NULL, 'pgtap_expired_state', now() - interval '1 minute');

SELECT is(
  (SELECT count(*)::int FROM public.service_qb_consume_oauth_state('pgtap_fresh_state')),
  1, 'fresh oauth state is consumable exactly once');

SELECT is(
  (SELECT count(*)::int FROM public.service_qb_consume_oauth_state('pgtap_fresh_state')),
  0, 'reused oauth state returns no seller/business row');

SELECT is(
  (SELECT count(*)::int FROM public.service_qb_consume_oauth_state('pgtap_expired_state')),
  0, 'expired oauth state cannot be consumed');

SELECT is(
  (SELECT count(*)::int FROM public.service_qb_consume_oauth_state('pgtap_unknown_state')),
  0, 'unknown oauth state returns nothing');

SELECT isnt(
  (SELECT consumed_at FROM public.quickbooks_oauth_states WHERE state_hash = 'pgtap_fresh_state'),
  NULL, 'consumption marks the state row consumed');

SELECT * FROM finish();
ROLLBACK;
