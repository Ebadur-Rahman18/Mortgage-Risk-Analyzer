-- Loan Programs Module – Database Schema
-- See docs/LOAN_PROGRAMS_SCHEMA.md for full specification.
-- Product = high-level loan type; Program = specific configuration of a product.

-- =============================================================================
-- 1. Loan Products Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.loan_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_name VARCHAR(150) NOT NULL,
  product_type VARCHAR(50) NOT NULL,
  term_months INT NOT NULL,
  rate_type VARCHAR(20) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.loan_products IS 'Broad loan product categories (e.g., Conventional 30Y Fixed).';
COMMENT ON COLUMN public.loan_products.product_type IS 'Conventional / FHA / VA / Jumbo / USDA / HELOC';
COMMENT ON COLUMN public.loan_products.rate_type IS 'Fixed / ARM';

-- =============================================================================
-- 2. Loan Programs Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.loan_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.loan_products(id) ON DELETE CASCADE,
  program_code VARCHAR(50) NOT NULL,
  program_name VARCHAR(150) NOT NULL,
  min_credit_score INT,
  max_ltv DECIMAL(5,2),
  max_dti DECIMAL(5,2),
  occupancy_type VARCHAR(50),
  loan_limit DECIMAL(15,2),
  pricing_engine_code VARCHAR(100),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(product_id, program_code)
);

COMMENT ON TABLE public.loan_programs IS 'Detailed program rules tied to a product (e.g., 95% LTV, 740+ FICO).';
COMMENT ON COLUMN public.loan_programs.occupancy_type IS 'Primary / Second Home / Investment';
COMMENT ON COLUMN public.loan_programs.pricing_engine_code IS 'Optional; for future pricing integration.';

-- Indexes for common lookups
CREATE INDEX IF NOT EXISTS idx_loan_products_is_active ON public.loan_products(is_active);
CREATE INDEX IF NOT EXISTS idx_loan_products_product_type ON public.loan_products(product_type);
CREATE INDEX IF NOT EXISTS idx_loan_programs_product_id ON public.loan_programs(product_id);
CREATE INDEX IF NOT EXISTS idx_loan_programs_is_active ON public.loan_programs(is_active);

-- Trigger to keep updated_at in sync
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER loan_products_updated_at
  BEFORE UPDATE ON public.loan_products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER loan_programs_updated_at
  BEFORE UPDATE ON public.loan_programs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- 3. Row Level Security (RLS)
-- Admin/SuperAdmin: Create, Edit, Disable. Loan Officer: Read-only.
-- =============================================================================
ALTER TABLE public.loan_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_programs ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read (for dropdown selection)
CREATE POLICY "loan_products_select_authenticated"
  ON public.loan_products FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "loan_programs_select_authenticated"
  ON public.loan_programs FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can insert/update/delete
CREATE POLICY "loan_products_admin_all"
  ON public.loan_products FOR ALL
  TO authenticated
  USING (public.has_role('admin'::public.app_role, auth.uid()))
  WITH CHECK (public.has_role('admin'::public.app_role, auth.uid()));

CREATE POLICY "loan_programs_admin_all"
  ON public.loan_programs FOR ALL
  TO authenticated
  USING (public.has_role('admin'::public.app_role, auth.uid()))
  WITH CHECK (public.has_role('admin'::public.app_role, auth.uid()));

-- =============================================================================
-- 4. Seed Data (from LOAN_PROGRAMS_SCHEMA.md)
-- =============================================================================
INSERT INTO public.loan_products (id, product_name, product_type, term_months, rate_type)
VALUES
  ('a0000001-0001-4000-8000-000000000001'::uuid, 'Conventional 30Y Fixed', 'Conventional', 360, 'Fixed'),
  ('a0000001-0001-4000-8000-000000000002'::uuid, 'FHA 30Y Fixed', 'FHA', 360, 'Fixed'),
  ('a0000001-0001-4000-8000-000000000003'::uuid, 'VA 30Y Fixed', 'VA', 360, 'Fixed'),
  ('a0000001-0001-4000-8000-000000000004'::uuid, 'Jumbo 30Y Fixed', 'Jumbo', 360, 'Fixed'),
  ('a0000001-0001-4000-8000-000000000005'::uuid, '5/1 ARM', 'Conventional', 360, 'ARM')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.loan_programs (product_id, program_code, program_name, min_credit_score, max_ltv, max_dti)
VALUES
  ('a0000001-0001-4000-8000-000000000001'::uuid, 'CONV-30-80-700', 'Conv 30Y Fixed 80% LTV 700+', 700, 80.00, 43.00),
  ('a0000001-0001-4000-8000-000000000001'::uuid, 'CONV-30-95-740', 'Conv 30Y Fixed 95% LTV 740+', 740, 95.00, 45.00),
  ('a0000001-0001-4000-8000-000000000002'::uuid, 'FHA-30-965', 'FHA 30Y 96.5% LTV', 580, 96.50, 50.00),
  ('a0000001-0001-4000-8000-000000000003'::uuid, 'VA-30-100', 'VA 100% Financing', 620, 100.00, 50.00)
ON CONFLICT (product_id, program_code) DO NOTHING;
