-- Phase 4 gaps: branch managers may mutate investor_submissions; hedge optional_symbol for benchmarks.

ALTER TABLE public.hedge_pipeline_snapshots
  ADD COLUMN IF NOT EXISTS optional_symbol TEXT;

COMMENT ON COLUMN public.hedge_pipeline_snapshots.optional_symbol IS 'Optional benchmark / hedge instrument label (future vendor marks).';

-- Align mutate policy with select: branch managers for loans in their branch.
DROP POLICY IF EXISTS "investor_submissions_mutate" ON public.investor_submissions;
CREATE POLICY "investor_submissions_mutate"
  ON public.investor_submissions FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = investor_submissions.loan_id
        AND (
          l.loan_officer_id = auth.uid()
          OR l.underwriter_id = auth.uid()
          OR public.has_role('admin'::public.app_role, auth.uid())
          OR (
            public.is_branch_manager(auth.uid())
            AND l.branch_id IS NOT NULL
            AND l.branch_id = public.user_branch_id(auth.uid())
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = investor_submissions.loan_id
        AND (
          l.loan_officer_id = auth.uid()
          OR l.underwriter_id = auth.uid()
          OR public.has_role('admin'::public.app_role, auth.uid())
          OR (
            public.is_branch_manager(auth.uid())
            AND l.branch_id IS NOT NULL
            AND l.branch_id = public.user_branch_id(auth.uid())
          )
        )
    )
  );
