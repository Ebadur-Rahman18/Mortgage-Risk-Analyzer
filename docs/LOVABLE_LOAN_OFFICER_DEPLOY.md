# Lovable / production prompt — Loan Officer (MCT Lite)

Copy everything in the block below into Lovable (or your deployment chat) so Supabase, edge functions, and modules line up with the Loan Officer demo.

---

## Prompt for Lovable

**Context:** This is the **MCT Lite** mortgage app. Loan officers (`Loan Officer` custom role / `branch_manager`) need: working **Add Loan** (`/loans/new`), **Borrowers**, **Action Items → Generate**, **HubSpot pipeline** in the sidebar (when the pipeline module is enabled), and **AI Chat / Agents** driven by admin-configured `ai_agents` rows.

**Database — run migrations in order** (use Supabase SQL Editor or `npx supabase db push` from the repo). Ensure at least these are applied:

- Core borrowers/loans/products (existing migrations).
- **`20260513120000_lite_branch_and_loan_products_seed.sql`** — seeds **Main Branch**, back-fills **`profiles.branch_id`** where null, seeds one **`loan_products`** + **`loan_programs`** row if the tables are empty.

**After migrations, verify in SQL:**

```sql
select count(*) as branches from public.branches where is_active = true;
select count(*) as products from public.loan_products where is_active = true;
select id, branch_id from public.profiles limit 5;
select slug, required_role, is_active from public.ai_agents where is_active = true;
```

For LO-facing AI browse/chat, ensure there are **`ai_agents`** rows with **`required_role`** containing **`loan_officer`** (or equivalent allowlist) so **`useRoleFilteredAgents`** returns agents.

**Enable modules (Admin → Module Management):** `loans`, `pipeline_views` (optional, for HubSpot nav), `tasks`, knowledge/AI flags as desired.

**Deploy edge functions** (Lovable Supabase integration or CLI). Minimum for **Action Items → Generate**:

- **`generate-daily-actions`** (uses shared AI routing in `_shared/ai-utils.ts`).

Also deploy functions your AI stack already depends on (typical set):

- **`run-ai-agent`**
- **`retrieve-agent-memories`**, **`extract-agent-memories`**
- **`validate-api-key`**
- **`sync-data-feed`** if HubSpot sync is used from **Pipeline** page

Use **`npx supabase functions deploy <name>`** per project convention.

**Secrets:** Configure provider keys in **`integration_settings`** or env (`OPENAI_API_KEY`, etc.) per `ai-utils` routing.

**Frontend env:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (not legacy anon key name).

**Smoke test as demo LO:**

1. Dashboard loads; sidebar shows **Loans**, **HubSpot pipeline** (if module on), **Borrowers**, **Tasks**, **Action Items**, **Knowledge**, **AI Chat**, **AI Agents**.
2. **Borrowers** lists rows or a clear error (RLS), not a blank page.
3. **Add Loan** shows the form (not blank); borrower dropdown populated; submit works when branch is set.
4. **Action Items** → **Generate** succeeds or shows a clear error if **`generate-daily-actions`** is missing.

---

## User role (`app_role` = `user`) — Lovable checklist

**Context:** Support/processor accounts see a **minimal sidebar**: Dashboard, Tasks, Action Items, Knowledge, Notifications, **AI Chat** only (no Loans, Borrowers, HubSpot pipeline, **AI Agents** catalog).

**App:** No extra edge functions beyond what you already deploy for LOs; **`user`** needs **`tasks:read`/`tasks:update`** (now in default `LITE_ROLE_PERMISSIONS.user`) so **Tasks** appears.

**Database:** Apply **`20260513190000_support_staff_custom_role.sql`** if you want a named **Support Staff** row in **`roles`** for Admin assignment; optional if everyone stays on system **`user`**.

**Smoke test as `user@demo.co` (or equivalent):**

1. Sidebar matches the short list above; **AI Agents** is hidden.
2. **Dashboard** shows cards for tasks, action items, notifications, knowledge, AI chat with counts when data exists.
3. Deep links to **`/loans`** still depend on RLS (typically denied without **`loans:read`**).

---

## What changed in app code (reference)

- **Add Loan blank screen:** was caused by treating **`useBorrowers()`** paginated result as an array; loan form now uses **`useBorrowersForSelect()`** and loading states for create mode.
- **Products:** **`useLoanProducts` / `useLoanPrograms`** return empty lists on error so the form still renders.
- **Generate:** explicit JWT header + cache invalidation + deploy hint when the function is missing.
