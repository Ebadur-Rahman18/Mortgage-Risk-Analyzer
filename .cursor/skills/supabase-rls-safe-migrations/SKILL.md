---
name: supabase-rls-safe-migrations
description: Safe migration workflow for Supabase schema and RLS changes.
---

# Supabase RLS Safe Migrations

## Apply When

- Editing `supabase/migrations/*.sql`
- Changing table/policy behavior used by hooks/functions

## Workflow

1. Add a new migration file (`YYYYMMDDHHMMSS_description.sql`).
2. Keep one purpose per migration.
3. Enable RLS + add policies for every new table.
4. Preserve compatibility unless a breaking change is explicitly approved.
5. Update affected hooks/types after schema changes.

## Required Checks

- [ ] No edits to old migrations
- [ ] Loan status changes coordinated with `transition-loan-status`
- [ ] Append-only tables (`loan_timeline_events`, `ai_agent_runs`, `activity_log`) remain append-only
- [ ] `npm run lint` passes for impacted TS files
