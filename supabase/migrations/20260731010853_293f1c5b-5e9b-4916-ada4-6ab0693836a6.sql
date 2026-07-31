-- Public, service-role-only bridges to the private QuickBooks helpers.
-- PostgREST only resolves RPC in exposed schemas; the private helpers were
-- unreachable from the Edge Functions, which broke the whole OAuth lifecycle.

CREATE OR REPLACE FUNCTION public.service_qb_create_token_secret(_bundle jsonb, _name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
BEGIN
  RETURN private.create_quickbooks_token_secret(_bundle, _name);
END;
$$;

CREATE OR REPLACE FUNCTION public.service_qb_update_token_secret(_secret_id uuid, _bundle jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
BEGIN
  PERFORM private.update_quickbooks_token_secret(_secret_id, _bundle);
END;
$$;

CREATE OR REPLACE FUNCTION public.service_qb_get_token_secret(_secret_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
BEGIN
  RETURN private.get_quickbooks_token_secret(_secret_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.service_qb_delete_token_secret(_secret_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
BEGIN
  PERFORM private.delete_quickbooks_token_secret(_secret_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.service_qb_consume_oauth_state(_state_hash text)
RETURNS TABLE(seller_id uuid, business_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
BEGIN
  RETURN QUERY SELECT * FROM private.consume_quickbooks_oauth_state(_state_hash);
END;
$$;

REVOKE ALL ON FUNCTION public.service_qb_create_token_secret(jsonb, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.service_qb_update_token_secret(uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.service_qb_get_token_secret(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.service_qb_delete_token_secret(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.service_qb_consume_oauth_state(text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.service_qb_create_token_secret(jsonb, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.service_qb_update_token_secret(uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.service_qb_get_token_secret(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.service_qb_delete_token_secret(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.service_qb_consume_oauth_state(text) TO service_role;