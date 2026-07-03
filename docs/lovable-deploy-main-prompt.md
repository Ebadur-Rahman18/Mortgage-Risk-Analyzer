# Lovable Deploy Prompt — MCT Lite (main, May 27 2026)

Three features were merged to `main` in this session. Copy the prompt below
directly into Lovable to complete the deployment.

---

## Lovable Prompt — paste this in full

```
We have merged 3 new features to the `main` branch of MCT Lite. Please apply
the following changes to bring Lovable in sync.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FEATURE 1 — Profile dropdown: "About Us" external link
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: src/components/layout/TopNav.tsx

Changes already in main — Lovable just needs to pull the latest code.
No DB migration, no new env vars, no new dependencies.

What was added:
- A module-level constant: ABOUT_URL = import.meta.env.VITE_ABOUT_BRAND_URL ?? "https://collabai.software/"
- Handler: handleAboutClick → window.open(ABOUT_URL, "_blank", "noopener,noreferrer")
- New "About Us" DropdownMenuItem (with Info icon + ExternalLink indicator) in the
  profile dropdown, between Admin Panel and Sign out.
- "Take Tour" DropdownMenuItem (see Feature 3 below).
- data-tour="profile" attribute on the DropdownMenuTrigger button.

Optional env var (add to Lovable environment settings if you want a custom URL):
  VITE_ABOUT_BRAND_URL = https://your-marketing-site.com/

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FEATURE 2 — Floating "Contact CollabAI" FAB (all roles)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILES: src/components/ContactCollabAIButton.tsx (new)
       src/assets/collabai-logo.png (new/updated)
       src/components/layout/DashboardLayout.tsx (edited)
       src/components/layout/AdminLayout.tsx (edited)

No DB migration. No new env vars. No new npm dependencies.

What was added:
- A fixed bottom-right circular FAB showing the CollabAI logo.
- Clicking opens https://collabai.software/contact in a new tab (noopener/noreferrer).
- Hover shows tooltip "contact collabAI" (side="left").
- Visible for ALL roles: mounted in both DashboardLayout and AdminLayout.
- z-index: 40 (below modals at 50).

Optional env var (add to Lovable environment settings to override the URL):
  VITE_COLLABAI_CONTACT_URL = https://collabai.software/contact

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FEATURE 3 — Role-aware guided onboarding tour
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

NEW FILES:
  src/hooks/useTour.ts
  src/components/tour/tourSteps.ts
  src/components/tour/AppTour.tsx
  src/contexts/TourContext.tsx

EDITED FILES:
  src/components/layout/DashboardLayout.tsx
  src/components/layout/AdminLayout.tsx
  src/components/layout/TopNav.tsx       ("Take Tour" menu item)
  src/components/layout/AppSidebar.tsx   (data-tour anchors on nav items)

NEW npm DEPENDENCY — already in package.json:
  "react-joyride": latest

ACTION REQUIRED IN LOVABLE: run npm install (or the build will fail without
react-joyride present in node_modules).

ACTION REQUIRED — SUPABASE MIGRATION:
Apply the migration file:
  supabase/migrations/20260527000000_add_tour_completed_at.sql

The migration SQL is:
  ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS tour_completed_at timestamptz;
  UPDATE public.profiles
    SET tour_completed_at = now()
    WHERE tour_completed_at IS NULL;

Run via: npx supabase db push
  OR paste the SQL directly in the Supabase dashboard → SQL editor.

WHY: Without this migration the tour falls back to localStorage (still works),
but with the migration tour completion is persisted per-user in the DB so it
survives browser clears and multi-device use.

ACTION REQUIRED — UPGRADE useTour.ts TO DB PERSISTENCE (after migration):
Currently src/hooks/useTour.ts uses localStorage. After the migration runs,
update the two localStorage lines to Supabase calls:

1. Replace the isCompleted() function body:
   OLD: return !!localStorage.getItem(`mct_tour_completed_${userId}`);
   NEW:
     const { data, error } = await supabase
       .from("profiles")
       .select("tour_completed_at")
       .eq("id", userId)
       .single();
     if (error) return true; // fail closed — do not nag on errors
     return !!data?.tour_completed_at;

2. Replace the markCompleted() function body:
   OLD: localStorage.setItem(`mct_tour_completed_${userId}`, new Date().toISOString());
   NEW:
     await supabase
       .from("profiles")
       .update({ tour_completed_at: new Date().toISOString() })
       .eq("id", userId);

3. Because isCompleted() becomes async, also:
   - Add useState for isCompletedState and useEffect to load it on mount.
   - Guard the auto-start effect with a "loaded" boolean (same pattern as
     useOnboarding.ts in this repo).
   - Keep fail-closed: on SELECT error, treat as completed = true.

HOW THE TOUR WORKS:
- New user (tour_completed_at IS NULL in DB / no localStorage key): tour
  auto-opens ~800ms after first landing on dashboard.
- Returning user: no auto-open.
- Any user: profile dropdown → "Take Tour" always re-opens the tour.
- Finish or Skip: writes completion; no more auto-open.

ROLE VARIANTS (steps auto-selected based on profile.role):
  Admin / Moderator    → 9 steps: Dashboard → Loans → Borrowers → Tasks →
                         Action Items → Knowledge → Notifications → AI Tools → Profile
  Loan Officer /
  Branch Manager       → 7 steps: Dashboard → Loans → Borrowers → Tasks →
                         Knowledge → AI Tools → Profile
  User (processor)     → 5 steps: Dashboard → Tasks → Knowledge →
                         AI Tools → Profile

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FULL QA CHECKLIST (run after deploy)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Feature 1 — About Us:
[ ] Open profile dropdown → "About Us" visible between Admin Panel and Sign out.
[ ] Click "About Us" → opens https://collabai.software/ in new tab.
[ ] No in-app navigation, no modal.

Feature 2 — Contact FAB:
[ ] Circular white FAB visible bottom-right on every authenticated page.
[ ] Hover → tooltip "contact collabAI" appears on the left.
[ ] Click → opens https://collabai.software/contact in new tab.
[ ] Visible for admin, loan_officer, and user roles.
[ ] FAB not covered by modals or tour overlay.

Feature 3 — Guided Tour:
[ ] New user account: land on dashboard → tour auto-starts after ~800ms.
[ ] Tour shows correct number of steps for the user's role.
[ ] "Next" / "Back" / "Skip tour" buttons work.
[ ] Finish tour → reload → no auto-start.
[ ] Profile dropdown → "Take Tour" → tour opens again regardless.
[ ] Admin role sees 9 steps including Loans, Borrowers, Notifications.
[ ] Loan Officer sees 7 steps (no Action Items, no Notifications step).
[ ] User role sees 5 steps (no Loans, Borrowers, Action Items, Notifications).
[ ] tour_completed_at written to profiles table on finish/skip (after migration).
[ ] Existing users NOT shown auto-tour (migration set their tour_completed_at).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SUMMARY OF ACTIONS REQUIRED IN LOVABLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Priority  | Action
----------|-------------------------------------------------------------
REQUIRED  | Pull latest main (all 14 changed files are already in repo)
REQUIRED  | npm install  (adds react-joyride)
REQUIRED  | Run Supabase migration: 20260527000000_add_tour_completed_at.sql
REQUIRED  | Upgrade useTour.ts localStorage → Supabase (code above)
OPTIONAL  | Add env var VITE_ABOUT_BRAND_URL if you want a custom About Us URL
OPTIONAL  | Add env var VITE_COLLABAI_CONTACT_URL if you want a custom FAB URL
```
