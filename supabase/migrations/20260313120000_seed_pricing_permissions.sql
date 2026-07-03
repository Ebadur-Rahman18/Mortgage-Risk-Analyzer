-- Seed pricing / rate lock permissions for core custom roles.
-- Safe to re-run: only sets permissions when currently empty.

DO $$
BEGIN
  -- Branch Manager: full pricing access for their branch
  UPDATE public.roles
  SET permissions = '[
    "pricing:read",
    "pricing:calculate",
    "rate_locks:read",
    "rate_locks:manage"
  ]'::jsonb
  WHERE slug = 'branch_manager'
    AND (permissions IS NULL OR jsonb_array_length(permissions::jsonb) = 0);

  -- Loan Officer: pricing calculator + manage own locks
  UPDATE public.roles
  SET permissions = '[
    "pricing:read",
    "pricing:calculate",
    "rate_locks:read",
    "rate_locks:manage"
  ]'::jsonb
  WHERE slug = 'loan_officer'
    AND (permissions IS NULL OR jsonb_array_length(permissions::jsonb) = 0);
END;
$$;

