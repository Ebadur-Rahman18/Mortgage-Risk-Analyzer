-- Optional link from a meeting to a loan (e.g. borrower appointment, loan-related sync).

ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS loan_id UUID REFERENCES public.loans(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_meetings_loan_id ON public.meetings(loan_id);

COMMENT ON COLUMN public.meetings.loan_id IS 'Optional loan this meeting relates to (borrower appointment, loan milestone discussion, etc.).';
