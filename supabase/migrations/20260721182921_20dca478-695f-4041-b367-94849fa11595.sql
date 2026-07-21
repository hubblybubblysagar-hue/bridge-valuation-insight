
-- Private schema, restricted to service_role
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO service_role;

-- Ensure vault extension is available (Supabase provides it)
CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA vault;

-- Uniqueness: one active connection per (seller, realm)
CREATE UNIQUE INDEX IF NOT EXISTS quickbooks_connections_seller_realm_uniq
  ON public.quickbooks_connections (seller_id, realm_id);

-- Server-only OAuth state table: strip any Data API access
REVOKE ALL ON public.quickbooks_oauth_states FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.quickbooks_oauth_states TO service_role;

-- Helpful index for state lookups
CREATE INDEX IF NOT EXISTS quickbooks_oauth_states_hash_idx
  ON public.quickbooks_oauth_states (state_hash);

-- ============ Vault token secret helpers ============

CREATE OR REPLACE FUNCTION private.create_quickbooks_token_secret(
  _bundle jsonb,
  _name text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, vault, pg_temp
AS $$
DECLARE
  new_id uuid;
BEGIN
  IF _bundle IS NULL OR jsonb_typeof(_bundle) <> 'object' THEN
    RAISE EXCEPTION 'invalid token bundle';
  END IF;
  IF NOT (_bundle ? 'access_token' AND _bundle ? 'refresh_token') THEN
    RAISE EXCEPTION 'token bundle missing required fields';
  END IF;
  SELECT vault.create_secret(_bundle::text, _name, 'quickbooks token bundle') INTO new_id;
  RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION private.update_quickbooks_token_secret(
  _secret_id uuid,
  _bundle jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, vault, pg_temp
AS $$
BEGIN
  IF _secret_id IS NULL THEN RAISE EXCEPTION 'secret id required'; END IF;
  IF _bundle IS NULL OR jsonb_typeof(_bundle) <> 'object' THEN
    RAISE EXCEPTION 'invalid token bundle';
  END IF;
  IF NOT (_bundle ? 'access_token' AND _bundle ? 'refresh_token') THEN
    RAISE EXCEPTION 'token bundle missing required fields';
  END IF;
  PERFORM vault.update_secret(_secret_id, _bundle::text);
END;
$$;

CREATE OR REPLACE FUNCTION private.get_quickbooks_token_secret(
  _secret_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, vault, pg_temp
AS $$
DECLARE
  raw text;
BEGIN
  IF _secret_id IS NULL THEN RAISE EXCEPTION 'secret id required'; END IF;
  SELECT decrypted_secret INTO raw
  FROM vault.decrypted_secrets
  WHERE id = _secret_id;
  IF raw IS NULL THEN RETURN NULL; END IF;
  RETURN raw::jsonb;
END;
$$;

CREATE OR REPLACE FUNCTION private.delete_quickbooks_token_secret(
  _secret_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, vault, pg_temp
AS $$
BEGIN
  IF _secret_id IS NULL THEN RETURN; END IF;
  DELETE FROM vault.secrets WHERE id = _secret_id;
END;
$$;

-- ============ Atomic single-use OAuth state consumer ============

CREATE OR REPLACE FUNCTION private.consume_quickbooks_oauth_state(
  _state_hash text
) RETURNS TABLE(seller_id uuid, business_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.quickbooks_oauth_states s
     SET consumed_at = now()
   WHERE s.state_hash = _state_hash
     AND s.consumed_at IS NULL
     AND s.expires_at > now()
  RETURNING s.seller_id, s.business_id;
END;
$$;

-- Lock down every helper: only service_role may execute
REVOKE ALL ON FUNCTION private.create_quickbooks_token_secret(jsonb, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.update_quickbooks_token_secret(uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.get_quickbooks_token_secret(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.delete_quickbooks_token_secret(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.consume_quickbooks_oauth_state(text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION private.create_quickbooks_token_secret(jsonb, text) TO service_role;
GRANT EXECUTE ON FUNCTION private.update_quickbooks_token_secret(uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION private.get_quickbooks_token_secret(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION private.delete_quickbooks_token_secret(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION private.consume_quickbooks_oauth_state(text) TO service_role;
