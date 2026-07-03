-- Ensure ai_agents.slug is always populated and normalized, including manual inserts.

CREATE OR REPLACE FUNCTION public.normalize_ai_agent_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  base_slug text;
  candidate_slug text;
  suffix integer := 0;
BEGIN
  base_slug := regexp_replace(lower(trim(COALESCE(NEW.slug, ''))), '[^a-z0-9]+', '-', 'g');
  base_slug := regexp_replace(base_slug, '(^-+|-+$)', '', 'g');

  IF base_slug = '' THEN
    base_slug := regexp_replace(lower(trim(COALESCE(NEW.name, ''))), '[^a-z0-9]+', '-', 'g');
    base_slug := regexp_replace(base_slug, '(^-+|-+$)', '', 'g');
  END IF;

  IF base_slug = '' THEN
    base_slug := 'agent';
  END IF;

  candidate_slug := base_slug;

  WHILE EXISTS (
    SELECT 1
    FROM public.ai_agents a
    WHERE a.slug = candidate_slug
      AND a.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) LOOP
    suffix := suffix + 1;
    candidate_slug := base_slug || '-' || suffix::text;
  END LOOP;

  NEW.slug := candidate_slug;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ai_agents_normalize_slug ON public.ai_agents;
CREATE TRIGGER ai_agents_normalize_slug
  BEFORE INSERT OR UPDATE ON public.ai_agents
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_ai_agent_slug();

-- Backfill any existing blank/null slugs (e.g. manually added rows like "Security Scout").
UPDATE public.ai_agents
SET slug = NULL
WHERE slug IS NULL OR btrim(slug) = '';

UPDATE public.ai_agents
SET slug = name
WHERE slug IS NULL;

ALTER TABLE public.ai_agents
  DROP CONSTRAINT IF EXISTS ai_agents_slug_not_blank;

ALTER TABLE public.ai_agents
  ADD CONSTRAINT ai_agents_slug_not_blank CHECK (length(btrim(slug)) > 0);
