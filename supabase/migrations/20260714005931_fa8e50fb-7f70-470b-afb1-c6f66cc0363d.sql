
REVOKE EXECUTE ON FUNCTION public.owns_business(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owns_business(uuid) TO authenticated, service_role;
