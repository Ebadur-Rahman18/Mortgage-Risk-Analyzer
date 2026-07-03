# Lovable Deploy Prompt — Guided Onboarding Tour

Use the prompt below when deploying / integrating the guided product tour feature
(`feature/guided-tour-onboarding`) via Lovable.

---

## Lovable Prompt

```
We have merged a new feature branch (feature/guided-tour-onboarding) that adds a
role-aware guided product tour to the MCT Lite app. Please complete the following
deployment steps:

### 1. Run the Supabase migration
Apply the migration at:
  supabase/migrations/20260527000000_add_tour_completed_at.sql

This adds a nullable `tour_completed_at timestamptz` column to `profiles` and
immediately sets it to `now()` for all existing users, so existing accounts are
NOT shown the auto-tour. Only new signups (who get a NULL value) see it on first login.

### 2. Update src/hooks/useTour.ts to use Supabase instead of localStorage
The current implementation uses localStorage for persistence (so it works with no
migration). Once the migration is applied, replace the read/write logic as follows:

Replace the `isCompleted` check:
  FROM: !!localStorage.getItem(`mct_tour_completed_${userId}`)
  TO:   fetch `tour_completed_at` from `profiles` for the current user via supabase.from("profiles").select("tour_completed_at").eq("id", userId).single()
        return !!data?.tour_completed_at

Replace the `markCompleted` call:
  FROM: localStorage.setItem(...)
  TO:   supabase.from("profiles").update({ tour_completed_at: new Date().toISOString() }).eq("id", userId)

Keep the same fail-closed pattern: if the SELECT errors, treat as completed (return true).

### 3. Verify RLS allows users to update their own tour_completed_at
The existing `profiles` RLS policies (users can UPDATE their own row) cover this column
automatically. No new policies needed.

### 4. Confirm npm dependency is installed
package.json should include "react-joyride". Run `npm install` if it is missing.

### 5. Test all 3 role variants
- Admin / Moderator → 9-step tour (dashboard → loans → borrowers → tasks →
  action items → knowledge → notifications → AI tools → profile)
- Loan Officer / Branch Manager → 7-step tour (dashboard → loans → borrowers →
  tasks → knowledge → AI tools → profile)
- User (processor/support) → 5-step tour (dashboard → tasks → knowledge →
  AI tools → profile)

### 6. QA checklist
- [ ] New user (tour_completed_at IS NULL): lands on dashboard → tour auto-starts ~800ms after page load.
- [ ] Finish tour → tour_completed_at written to DB → reload → no auto-start.
- [ ] Click profile avatar → "Take Tour" → tour opens regardless of completion state.
- [ ] Skip tour → DB written → no auto-start on next visit.
- [ ] All 3 role variants show the correct steps (only nav items visible to that role).
- [ ] Tour tooltip z-index (10000) does not conflict with modals.
- [ ] Contact CollabAI FAB (bottom-right) still visible and not covered by tour backdrop.
```

---

## Files changed in this branch

| File | Purpose |
|------|---------|
| `src/hooks/useTour.ts` | Tour state, auto-open logic, localStorage persistence |
| `src/components/tour/tourSteps.ts` | Step definitions for admin / loan_officer / user |
| `src/components/tour/AppTour.tsx` | react-joyride wrapper component |
| `src/contexts/TourContext.tsx` | Context so TopNav can call startTour without prop drilling |
| `src/components/layout/DashboardLayout.tsx` | Provides TourContext, renders AppTour |
| `src/components/layout/AdminLayout.tsx` | Provides TourContext (admin variant), renders AppTour |
| `src/components/layout/TopNav.tsx` | "Take Tour" menu item + data-tour="profile" on trigger |
| `src/components/layout/AppSidebar.tsx` | data-tour anchors on each nav item |
| `supabase/migrations/20260527000000_add_tour_completed_at.sql` | DB migration |

---

## After upgrading to DB persistence (post-migration)

Update `src/hooks/useTour.ts` to replace the two localStorage lines with Supabase calls:

```ts
// REPLACE isCompleted()
const { data, error } = await supabase
  .from("profiles")
  .select("tour_completed_at")
  .eq("id", userId)
  .single();
if (error) return true; // fail closed
return !!data?.tour_completed_at;

// REPLACE markCompleted()
await supabase
  .from("profiles")
  .update({ tour_completed_at: new Date().toISOString() })
  .eq("id", userId);
```

You will also need to make `useTour` async and adjust the `useEffect` guards accordingly.
