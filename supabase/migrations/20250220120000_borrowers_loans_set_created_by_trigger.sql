-- Ensure INSERT passes RLS for loan officers: set created_by = auth.uid() when null.
-- This allows the WITH CHECK (created_by = auth.uid()) policy to pass even if the client omits created_by.

CREATE OR REPLACE FUNCTION public.set_created_by_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.set_created_by_on_insert() IS 'BEFORE INSERT: set created_by to current user when null so RLS policies allow the insert.';

DROP TRIGGER IF EXISTS borrowers_set_created_by ON public.borrowers;
CREATE TRIGGER borrowers_set_created_by
  BEFORE INSERT ON public.borrowers
  FOR EACH ROW
  EXECUTE FUNCTION public.set_created_by_on_insert();

DROP TRIGGER IF EXISTS loans_set_created_by ON public.loans;
CREATE TRIGGER loans_set_created_by
  BEFORE INSERT ON public.loans
  FOR EACH ROW
  EXECUTE FUNCTION public.set_created_by_on_insert();
