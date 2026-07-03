-- Unified timeline backbone: every action from every system in one log per loan.
-- The LoanTimeline UI component will read from this table.
-- Risk Engine triggers can fire "on timeline event" once that is implemented.

CREATE TABLE IF NOT EXISTS public.loan_timeline_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  event_source VARCHAR(50) NOT NULL DEFAULT 'manual',
  title VARCHAR(255) NOT NULL,
  description TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.loan_timeline_events IS 'Unified timeline: every action across all systems for a loan.';
COMMENT ON COLUMN public.loan_timeline_events.event_type IS 'status_change | condition_received | doc_uploaded | milestone_reached | lock_event | note | system';
COMMENT ON COLUMN public.loan_timeline_events.event_source IS 'manual | lendingpad | arive | control_tower | email | system';

CREATE INDEX IF NOT EXISTS idx_timeline_loan_id ON public.loan_timeline_events(loan_id);
CREATE INDEX IF NOT EXISTS idx_timeline_event_type ON public.loan_timeline_events(event_type);
CREATE INDEX IF NOT EXISTS idx_timeline_occurred_at ON public.loan_timeline_events(occurred_at);

-- =============================================================================
-- RLS
-- =============================================================================
ALTER TABLE public.loan_timeline_events ENABLE ROW LEVEL SECURITY;

-- Admin: full access
DROP POLICY IF EXISTS "timeline_admin_all" ON public.loan_timeline_events;
CREATE POLICY "timeline_admin_all"
  ON public.loan_timeline_events FOR ALL
  TO authenticated
  USING (public.has_role('admin'::public.app_role, auth.uid()))
  WITH CHECK (public.has_role('admin'::public.app_role, auth.uid()));

-- Branch Manager: read events for loans in their branch
DROP POLICY IF EXISTS "timeline_branch_manager_select" ON public.loan_timeline_events;
CREATE POLICY "timeline_branch_manager_select"
  ON public.loan_timeline_events FOR SELECT
  TO authenticated
  USING (
    public.is_branch_manager(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = loan_timeline_events.loan_id
      AND l.branch_id IS NOT NULL
      AND l.branch_id = public.user_branch_id(auth.uid())
    )
  );

-- Loan Officer: read events for their own loans
DROP POLICY IF EXISTS "timeline_loan_officer_select" ON public.loan_timeline_events;
CREATE POLICY "timeline_loan_officer_select"
  ON public.loan_timeline_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = loan_timeline_events.loan_id AND l.loan_officer_id = auth.uid()
    )
  );

-- Loan Officer: create events for their own loans
DROP POLICY IF EXISTS "timeline_loan_officer_insert" ON public.loan_timeline_events;
CREATE POLICY "timeline_loan_officer_insert"
  ON public.loan_timeline_events FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = loan_id AND l.loan_officer_id = auth.uid()
    )
  );
