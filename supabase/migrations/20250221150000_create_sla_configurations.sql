-- SLA rules: define expected turnaround times for mortgage operations.
-- Superadmin configures; all authenticated users can read.

CREATE TABLE IF NOT EXISTS public.sla_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(150) NOT NULL,
  description TEXT,
  scope VARCHAR(50) NOT NULL,
  from_status VARCHAR(100),
  to_status VARCHAR(100),
  target_hours INT NOT NULL,
  warning_hours INT,
  severity VARCHAR(20) NOT NULL DEFAULT 'medium',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.sla_configurations IS 'Defines SLA rules for tracking turnaround times and breaches.';
COMMENT ON COLUMN public.sla_configurations.scope IS 'condition | milestone | stage_transition';
COMMENT ON COLUMN public.sla_configurations.from_status IS 'Starting status/stage (for stage_transition scope).';
COMMENT ON COLUMN public.sla_configurations.to_status IS 'Ending status/stage (for stage_transition scope).';
COMMENT ON COLUMN public.sla_configurations.target_hours IS 'Maximum allowed hours before SLA breach.';
COMMENT ON COLUMN public.sla_configurations.warning_hours IS 'Hours remaining before breach at which to show warning.';
COMMENT ON COLUMN public.sla_configurations.severity IS 'low | medium | high | critical';

CREATE INDEX IF NOT EXISTS idx_sla_scope ON public.sla_configurations(scope);
CREATE INDEX IF NOT EXISTS idx_sla_active ON public.sla_configurations(is_active);

DROP TRIGGER IF EXISTS sla_configurations_updated_at ON public.sla_configurations;
CREATE TRIGGER sla_configurations_updated_at
  BEFORE UPDATE ON public.sla_configurations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- RLS
-- =============================================================================
ALTER TABLE public.sla_configurations ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read SLA rules
DROP POLICY IF EXISTS "sla_select_authenticated" ON public.sla_configurations;
CREATE POLICY "sla_select_authenticated"
  ON public.sla_configurations FOR SELECT
  TO authenticated
  USING (true);

-- Only admin can create/update/delete SLA rules
DROP POLICY IF EXISTS "sla_admin_all" ON public.sla_configurations;
CREATE POLICY "sla_admin_all"
  ON public.sla_configurations FOR ALL
  TO authenticated
  USING (public.has_role('admin'::public.app_role, auth.uid()))
  WITH CHECK (public.has_role('admin'::public.app_role, auth.uid()));

-- =============================================================================
-- Seed: common mortgage SLA rules
-- =============================================================================
INSERT INTO public.sla_configurations
  (name, description, scope, from_status, to_status, target_hours, warning_hours, severity)
VALUES
  (
    'Condition Response Time',
    'Time allowed for borrower to respond to a condition request',
    'condition', NULL, NULL,
    72, 48, 'medium'
  ),
  (
    'Application to Submission',
    'Time from application received to submission to underwriting',
    'stage_transition', 'application', 'submitted_to_uw',
    48, 24, 'high'
  ),
  (
    'Underwriting Turn Time',
    'Time for underwriting decision after submission',
    'stage_transition', 'submitted_to_uw', 'conditional_approval',
    72, 48, 'high'
  ),
  (
    'Conditional to CTC',
    'Time from conditional approval to clear to close',
    'stage_transition', 'conditional_approval', 'clear_to_close',
    120, 72, 'critical'
  ),
  (
    'CTC to Docs Out',
    'Time from clear to close to closing docs sent out',
    'stage_transition', 'clear_to_close', 'docs_out',
    48, 24, 'high'
  ),
  (
    'Docs Out to Funding',
    'Time from closing docs out to funding',
    'stage_transition', 'docs_out', 'funding',
    72, 48, 'critical'
  ),
  (
    'Lock Expiry Warning',
    'Warning before rate lock expiration',
    'milestone', 'lock_date', 'lock_expiration',
    168, 72, 'critical'
  );
