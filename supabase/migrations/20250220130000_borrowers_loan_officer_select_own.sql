-- Loan officers can SELECT borrowers they created (created_by = auth.uid()),
-- so they can see them in the dropdown on /loans/new before any loan links exist.
-- Existing policy only allowed SELECT when borrower was linked to a loan of theirs.

CREATE POLICY "borrowers_loan_officer_select_own"
  ON public.borrowers FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());
