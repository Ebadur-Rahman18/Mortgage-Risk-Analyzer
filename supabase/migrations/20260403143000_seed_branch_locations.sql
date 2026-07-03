-- Seed branch "locations" (Midtown / Brooklyn / etc.)
-- Manager requested these branches so branch managers and MLOs can be scoped correctly.

INSERT INTO public.branches (name, code, is_active)
VALUES
  ('Midtown Manhattan', 'midtown_manhattan', true),
  ('Brooklyn', 'brooklyn', true),
  ('Astoria', 'astoria', true),
  ('Flushing', 'flushing', true),
  ('Bronx / Riverdale', 'bronx_riverdale', true)
ON CONFLICT (code) DO NOTHING;

