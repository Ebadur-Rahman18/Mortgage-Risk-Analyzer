-- Assign demo users to a default branch so branch-scoped agents work.
-- Manager mapping requested: Branch managers + MLO/loan officers should belong to branches.

DO $$
DECLARE
  target_branch UUID;
BEGIN
  SELECT id INTO target_branch
  FROM public.branches
  WHERE code = 'midtown_manhattan'
  LIMIT 1;

  IF target_branch IS NULL THEN
    -- Branch locations not present (should be created by the prior migration).
    RETURN;
  END IF;

  -- Demo Branch Manager
  UPDATE public.profiles
  SET branch_id = target_branch
  WHERE email = 'branchmanager@collabai.software';

  -- Demo Loan Officer (MLO)
  UPDATE public.profiles
  SET branch_id = target_branch
  WHERE email = 'loanofficer@collabai.software';
END $$;

