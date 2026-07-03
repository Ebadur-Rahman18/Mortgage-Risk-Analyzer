---
name: react-query-feature-workflow
description: Fast workflow for frontend changes using existing hooks, React Query patterns, and route guards.
---

# React Query Feature Workflow

## Apply When

- Editing `src/pages/*` or `src/hooks/*`
- Adding data fetching/mutations/forms
- Adding permission-aware UI or routes

## Workflow

1. Reuse an existing hook from `src/hooks` before creating a new one.
2. If adding a hook, use React Query + shared keys from `@/lib/cache`.
3. For mutations: invalidate queries + `logCrud` + `sonner` toast.
4. Put schemas in `src/lib/validation.ts` (not inline in pages).
5. Use proper route guards (`ProtectedRoute`, `AdminRoute`, `ModuleRoute`).
6. Keep Supabase calls in hooks, not in components/pages.

## Quick Checklist

- [ ] Hook reused or created with shared query-key patterns
- [ ] Mutation side effects wired (invalidate + log + toast)
- [ ] Validation schema centralized
- [ ] Route/nav updated where needed
- [ ] `npm run lint` passes for touched files
