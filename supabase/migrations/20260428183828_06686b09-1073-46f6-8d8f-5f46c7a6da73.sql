
-- 1. App role enum
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'loan_officer', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT, full_name TEXT, avatar_url TEXT, branch_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Custom roles
CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE, description TEXT,
  permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

-- 4. User roles
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'user',
  custom_role_id UUID REFERENCES public.roles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 5. has_role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- 6. Module settings
CREATE TABLE IF NOT EXISTS public.module_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL, description TEXT,
  enabled BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.module_settings ENABLE ROW LEVEL SECURITY;

-- 7. Activity logs
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL, resource_type TEXT NOT NULL,
  resource_id TEXT, details JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT, user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT activity_logs_resource_type_check CHECK (
    resource_type IN ('auth','loan','borrower','client','meeting','task','knowledge','user','role','module','agent','document','rate_lock','pricing','compliance','system','other')
  )
);
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- 8. log_activity
CREATE OR REPLACE FUNCTION public.log_activity(
  p_action TEXT, p_resource_type TEXT,
  p_resource_id TEXT DEFAULT NULL, p_details JSONB DEFAULT '{}'::jsonb
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id UUID;
BEGIN
  INSERT INTO public.activity_logs (user_id, action, resource_type, resource_id, details)
  VALUES (auth.uid(), p_action, p_resource_type, p_resource_id, COALESCE(p_details,'{}'::jsonb))
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- 9. Borrowers
CREATE TABLE IF NOT EXISTS public.borrowers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL, last_name TEXT NOT NULL,
  email TEXT, phone TEXT, ssn_last4 TEXT, date_of_birth DATE,
  address_line1 TEXT, address_line2 TEXT, city TEXT, state TEXT, zip_code TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.borrowers ENABLE ROW LEVEL SECURITY;

-- 10. Loans
CREATE TABLE IF NOT EXISTS public.loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_number TEXT UNIQUE,
  borrower_id UUID REFERENCES public.borrowers(id) ON DELETE SET NULL,
  loan_officer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  loan_amount NUMERIC(14,2), interest_rate NUMERIC(6,4),
  loan_type TEXT, loan_purpose TEXT,
  property_address TEXT, property_city TEXT, property_state TEXT, property_zip TEXT,
  status TEXT NOT NULL DEFAULT 'application', stage TEXT,
  estimated_close_date DATE, notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;

-- 11. Tasks
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL, description TEXT,
  status TEXT NOT NULL DEFAULT 'open', priority TEXT DEFAULT 'medium',
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  loan_id UUID REFERENCES public.loans(id) ON DELETE CASCADE,
  due_date TIMESTAMPTZ, completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- 12. Knowledge
CREATE TABLE IF NOT EXISTS public.knowledge_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL, content TEXT, category TEXT,
  tags TEXT[] DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.knowledge_entries ENABLE ROW LEVEL SECURITY;

-- 13. Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL, body TEXT, type TEXT DEFAULT 'info',
  read_at TIMESTAMPTZ, link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 14. AI chat
CREATE TABLE IF NOT EXISTS public.ai_chat_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_chat_threads ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.ai_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.ai_chat_threads(id) ON DELETE CASCADE,
  role TEXT NOT NULL, content TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_chat_messages ENABLE ROW LEVEL SECURITY;

-- 15. User permission settings
CREATE TABLE IF NOT EXISTS public.user_permission_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_permission_settings ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- POLICIES
-- ============================================================
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "roles_read" ON public.roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "roles_admin_write" ON public.roles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "user_roles_read_own" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "user_roles_admin_write" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "module_settings_read" ON public.module_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "module_settings_admin_write" ON public.module_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "activity_logs_read" ON public.activity_logs FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "activity_logs_insert" ON public.activity_logs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "borrowers_admin_all" ON public.borrowers FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "borrowers_lo_own" ON public.borrowers FOR ALL TO authenticated USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());

CREATE POLICY "loans_admin_all" ON public.loans FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "loans_lo_own" ON public.loans FOR ALL TO authenticated USING (loan_officer_id = auth.uid() OR created_by = auth.uid()) WITH CHECK (loan_officer_id = auth.uid() OR created_by = auth.uid());

CREATE POLICY "tasks_admin_all" ON public.tasks FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "tasks_user_own" ON public.tasks FOR ALL TO authenticated USING (assigned_to = auth.uid() OR created_by = auth.uid()) WITH CHECK (assigned_to = auth.uid() OR created_by = auth.uid());

CREATE POLICY "knowledge_read" ON public.knowledge_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "knowledge_admin_write" ON public.knowledge_entries FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "notifications_own" ON public.notifications FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "ai_threads_own" ON public.ai_chat_threads FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "ai_messages_own" ON public.ai_chat_messages FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ai_chat_threads t WHERE t.id = thread_id AND t.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.ai_chat_threads t WHERE t.id = thread_id AND t.user_id = auth.uid()));

CREATE POLICY "ups_own_read" ON public.user_permission_settings FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "ups_admin_write" ON public.user_permission_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============================================================
-- TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DO $$ DECLARE t TEXT; BEGIN
  FOR t IN SELECT unnest(ARRAY['profiles','roles','module_settings','borrowers','loans','tasks','knowledge_entries','user_permission_settings','ai_chat_threads']) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON public.%I', t);
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at()', t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (NEW.id, NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- SEED MODULES (Lite: 8 enabled, 12 hidden)
-- ============================================================
INSERT INTO public.module_settings (slug, name, description, enabled, display_order) VALUES
  ('dashboard','Dashboard','Role-aware home',true,10),
  ('loans','Loans / Pipeline','Core loan pipeline',true,20),
  ('borrowers','Borrowers','Borrower management',true,30),
  ('tasks','Tasks','Task management',true,40),
  ('knowledge','Knowledge Base','Knowledge entries',true,50),
  ('ai_chat','AI Chat','AI assistant',true,60),
  ('notifications','Notifications','In-app notifications',true,70),
  ('admin','Admin Panel','User & module management',true,80),
  ('pipeline_views','Pipeline Views','Advanced pipeline views',false,100),
  ('communication_center','Communication Center','Borrower comms',false,110),
  ('email_intelligence','Email Intelligence','Gmail/Outlook AI',false,120),
  ('underwriting_queue','Underwriting Queue','UW workflow',false,130),
  ('document_review','Document Review','Doc review queue',false,140),
  ('pricing','Pricing & Rate Lock','Pricing engine',false,150),
  ('compliance','Compliance','Compliance screening',false,160),
  ('clients','Clients','CRM clients',false,170),
  ('meetings','Meetings','Meetings & calendars',false,180),
  ('agents','AI Agents','Agent runtime',false,190),
  ('manager_dashboard','Manager Dashboard','Manager control tower',false,200),
  ('feedback','Feedback','Feedback channel',false,210)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description,
  enabled = EXCLUDED.enabled, display_order = EXCLUDED.display_order, updated_at = now();

-- ============================================================
-- SEED 3 DEMO USERS
-- ============================================================
CREATE OR REPLACE FUNCTION public._seed_demo_user(p_email TEXT, p_password TEXT, p_name TEXT, p_role public.app_role)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, extensions AS $$
DECLARE v_id UUID;
BEGIN
  SELECT id INTO v_id FROM auth.users WHERE email = p_email;
  IF v_id IS NULL THEN
    v_id := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change,
      email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_id, 'authenticated', 'authenticated', p_email,
      extensions.crypt(p_password, extensions.gen_salt('bf')),
      now(),
      jsonb_build_object('provider','email','providers',jsonb_build_array('email')),
      jsonb_build_object('full_name', p_name),
      now(), now(), '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (
      gen_random_uuid(), v_id, v_id::text,
      jsonb_build_object('sub', v_id::text, 'email', p_email, 'email_verified', true),
      'email', now(), now(), now()
    );
  ELSE
    UPDATE auth.users SET
      encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')),
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      updated_at = now()
    WHERE id = v_id;
  END IF;
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (v_id, p_email, p_name)
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, full_name = EXCLUDED.full_name;
  DELETE FROM public.user_roles WHERE user_id = v_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_id, p_role);
  RETURN v_id;
END $$;

SELECT public._seed_demo_user('admin@demo.co', 'DemoAdmin!2026', 'Demo Admin',        'admin'::public.app_role);
SELECT public._seed_demo_user('lo@demo.co',    'DemoLO!2026',    'Demo Loan Officer', 'loan_officer'::public.app_role);
SELECT public._seed_demo_user('user@demo.co',  'DemoU!2026',     'Demo User',         'user'::public.app_role);

DROP FUNCTION public._seed_demo_user(TEXT, TEXT, TEXT, public.app_role);
