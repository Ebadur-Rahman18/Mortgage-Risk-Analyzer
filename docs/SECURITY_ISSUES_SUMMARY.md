# Security Issues Summary — For Project Manager

This document explains the 6 security findings (from Lovable/Supabase advisors) in plain language: what they mean, what's wrong, what to fix, and whether to fix now or later.

---

## 1. RLS policies exist but RLS is disabled on the table (Lint 0007)

**What it means**  
Row Level Security (RLS) **policies** are defined on a table, but RLS is **not enabled** on that table. So the policies never run and do nothing.

**Why it's a problem**  
With RLS off, Postgres ignores all policies. Every role that can access the table (e.g. `authenticated`) can read/write all rows, regardless of what the policies say. So you think you have protection, but you don't.

**What to do**  
- In Supabase: identify which table(s) the advisor reports (e.g. "policy exists, RLS disabled").
- Run:  
  `ALTER TABLE public.<table_name> ENABLE ROW LEVEL SECURITY;`  
- Add this to a migration so the fix is version-controlled and repeatable.

**Fix now or later?**  
**Fix as soon as possible.** Until RLS is enabled, that table is effectively unprotected for any role that can hit it via the API.

---

## 2. RLS not enabled on tables in schemas exposed to PostgREST (Lint 0013)

**What it means**  
PostgREST (Supabase's API layer) exposes the `public` schema (and possibly others). Any table in that exposed schema that does **not** have RLS enabled is readable/writable by anyone who has the anon or authenticated key and knows the table name.

**Why it's a problem**  
If a table is in `public` and RLS is off, then:
- With the **anon** key: access depends only on PostgREST config (often full CRUD).
- With the **authenticated** key: any logged-in user can access all rows.

So one misconfiguration can expose entire tables.

**What to do**  
- In Supabase Security/Performance Advisor, see which tables in `public` (or other exposed schemas) are reported.
- For each:  
  `ALTER TABLE public.<table_name> ENABLE ROW LEVEL SECURITY;`  
  then add at least one policy per operation (SELECT/INSERT/UPDATE/DELETE) that matches your business rules.
- Put these changes in migrations.

**Fix now or later?**  
**Fix immediately** for any table that holds sensitive or user-specific data. This is a core security control for Supabase.

---

## 3. Views defined with SECURITY DEFINER (Lint 0010)

**What it means**  
A **view** is created with `SECURITY DEFINER`. That means the view runs with the **owner's** privileges and RLS context, not the **caller's**. So users can see data the view owner can see, even if their own RLS would normally hide it.

**Why it's a problem**  
- RLS and "user A only sees their data" can be bypassed through the view.
- If the view owner is a superuser or has broad rights, users get more access than intended.
- It's easy to accidentally over-expose data.

**What to do**  
- List views:  
  `SELECT * FROM pg_views WHERE schemaname = 'public';`  
  and check their definition (e.g. in `pg_get_viewdef`) for `SECURITY DEFINER`.
- Prefer **SECURITY INVOKER** (default for views in recent Postgres) so the view runs as the current user and respects their RLS.
- If you must keep DEFINER, restrict the view definition and document why.

**In this repo**  
Migrations don't define any `CREATE VIEW`; RLS helpers use **SECURITY DEFINER functions** (e.g. `is_branch_manager`, `user_branch_id`, `set_created_by_on_insert`), which are a different lint. If the advisor only reports "security definer view," the view may exist only in the live DB (created in dashboard or elsewhere). Fix those views when you find them.

**Fix now or later?**  
**Fix soon.** Depends how sensitive the data in the view is. If the view returns PII or internal data, treat it as high priority.

---

## 4. `profiles` table — RLS disabled, contains sensitive data

**What it means**  
The `profiles` table holds user profile data (e.g. email, full name). RLS is **disabled**, so any client or role that can query `public.profiles` can read (and possibly write) all profiles.

**Why it's a problem**  
- Emails and names can be used for phishing, impersonation, or spam.
- Compliance (e.g. GDPR) expects access to personal data to be restricted and auditable.
- With RLS off, there is no row-level restriction; it's "all or nothing" per role.

**What to do**  
1. Enable RLS:  
   `ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;`
2. Add policies, for example:
   - **SELECT**: user can read own row (`id = auth.uid()`); optionally, admins can read all (using your `has_role('admin', auth.uid())` or equivalent).
   - **INSERT**: typically only service/trigger or authenticated user for their own row (e.g. on sign-up).
   - **UPDATE**: user can update own row; admins can update any (if required).
   - **DELETE**: restrict (e.g. only admin or no direct delete).

Add these in a migration so they apply consistently (e.g. in this repo, the `profiles` table is referenced in branches and seed migrations but may have been created elsewhere).

**Fix now or later?**  
**Fix immediately.** Profiles are sensitive and often the first place an attacker or auditor looks.

---

## 5. `clients` table — Over-permissive SELECT policy

**What it means**  
There is a policy like "Users can view all clients" that gives **every** authenticated user SELECT on **all** client rows. So any logged-in user can see every client's emails, phones, company names, etc.

**Why it's a problem**  
- Violates least privilege and likely internal policy ("only see my clients" or "only see clients in my branch").
- Increases risk of data misuse and GDPR-style issues (access to personal data beyond what's necessary).
- Makes insider threats and accidental leaks more likely.

**What to do**  
1. Keep RLS enabled (if it already is).
2. Replace the "view all clients" policy with a restrictive one, e.g.:
   - Users see only clients they created:  
     `created_by = auth.uid()`
   - Or only clients "assigned" to them:  
     `assigned_to = auth.uid()` (if you have such a column).
   - Admins (or specific roles) can still have a separate policy to see all clients.
3. Apply the same principle to INSERT/UPDATE/DELETE if they exist (e.g. only creator or assignee can update).

Example pattern:

```sql
-- Drop the broad policy
DROP POLICY IF EXISTS "Users can view all clients" ON public.clients;

-- Restrict to own/assigned clients (adjust to your schema)
CREATE POLICY "Users can view own or assigned clients"
  ON public.clients FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR assigned_to = auth.uid()
    OR public.has_role('admin'::public.app_role, auth.uid())
  );
```

**Fix now or later?**  
**Fix as soon as possible.** Customer data is sensitive and broad access is both a compliance and a trust issue.

---

## 6. Critical vulnerability in dependencies — jsPDF (e.g. CVE-2025-68428)

**What it means**  
The project depends on `jspdf` (e.g. ^3.0.4). That version has a **Local File Inclusion / Path Traversal** issue: in **Node.js** builds, user-controlled input to methods like `loadFile`, `addImage`, `html`, or `addFont` can be used to read arbitrary files from the server and include them in the generated PDF.

**Why it's a problem**  
- **On the server (Node/Edge):** If you use jsPDF in an Edge Function or any Node backend and pass user-controlled paths or file names into those methods, an attacker could read sensitive files (env, keys, other users' data).
- **In the browser:** The advisory states the **browser** bundles are **not** affected; only Node builds are. So risk is lower for a pure Vite/React frontend that only uses the browser build.

**What to do**  
- **Upgrade:** Use jsPDF **4.0.0+** (patched). In `package.json` set e.g. `"jspdf": "^4.0.0"` and run `npm install`, then test any PDF generation.
- **If you don't use jsPDF:** Remove it from `package.json` and run `npm install` to shrink the dependency tree and eliminate the finding.
- **If you must stay on 3.x on Node:** Avoid passing user-controlled paths into `loadFile`/`addImage`/`html`/`addFont`; sanitize strictly or use a allowlist. Prefer upgrading.

**In this repo**  
- `jspdf` is in `package.json` (^3.0.4) but there are no direct imports in `src`. PDF handling in the app is for **viewing** (e.g. Knowledge PDFs), not for **generating** PDFs with jsPDF. So either:
  - jsPDF is unused → **remove it** and the vulnerability goes away, or  
  - it's a transitive/legacy dependency → **upgrade to 4.x** and re-run audit.

**Fix now or later?**  
- **If you use jsPDF in Node/Edge:** **Fix immediately** (upgrade or remove).
- **If you only use the browser bundle and don't call the affected methods with user input:** Lower urgency, but **still upgrade or remove** to clear the advisory and avoid future misuse.

---

## Summary table for your project manager

| # | Issue | Severity | Action | When |
|---|--------|----------|--------|------|
| 1 | Policies exist but RLS disabled on table | High | Enable RLS on the reported table(s) | ASAP |
| 2 | RLS disabled on tables in public (PostgREST-exposed) | High | Enable RLS + add policies on each such table | ASAP |
| 3 | SECURITY DEFINER view(s) | Medium | Switch to INVOKER or restrict and document | Soon |
| 4 | `profiles` — RLS off, sensitive data | Critical | Enable RLS + restrict to own profile (and admin if needed) | Immediately |
| 5 | `clients` — "view all" policy | High | Restrict to creator/assigned (and admin if needed) | ASAP |
| 6 | jsPDF vulnerability (CVE-2025-68428) | Critical if used in Node; Low if browser-only | Upgrade to 4.x or remove dependency | Immediately if Node; soon otherwise |

**Recommendation**  
- **Do not ignore** 1, 2, 4, and 5; they directly affect who can see or change data. Fix 4 and 5 first (profiles and clients), then 1 and 2 for any other reported tables.  
- **Address 3** when you have a list of views from the live DB.  
- **Address 6** by upgrading or removing jsPDF; prioritize if you use it in Edge/Node with user input.

After fixes, re-run the Supabase Security/Performance Advisor and `npm audit` to confirm the findings are resolved.
