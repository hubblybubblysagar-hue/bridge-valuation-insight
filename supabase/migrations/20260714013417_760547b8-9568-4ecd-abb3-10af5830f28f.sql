
-- Add uniqueness constraints to prevent duplicate rows and support upserts.
ALTER TABLE public.buyer_profiles ADD CONSTRAINT buyer_profiles_buyer_id_key UNIQUE (buyer_id);
ALTER TABLE public.risk_answers ADD CONSTRAINT risk_answers_business_id_key UNIQUE (business_id);
ALTER TABLE public.valuations ADD CONSTRAINT valuations_business_id_key UNIQUE (business_id);
ALTER TABLE public.teasers ADD CONSTRAINT teasers_business_id_key UNIQUE (business_id);
ALTER TABLE public.buyer_interest_tests ADD CONSTRAINT buyer_interest_tests_business_id_key UNIQUE (business_id);
CREATE UNIQUE INDEX nda_requests_buyer_teaser_key ON public.nda_requests (buyer_id, teaser_id);
