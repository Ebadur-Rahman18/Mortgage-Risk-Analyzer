## Problem

When an admin invites a user whose email already exists, the UI shows a raw error like "Edge function returned non-2xx status code" instead of a clear message.

Two issues:
1. **Edge function** returns HTTP 409 for duplicates → Supabase client treats non-2xx as a thrown `FunctionsHttpError` and swallows the JSON body, so `data.error` is never read.
2. **Frontend hook** (`useCreateUserInvite`) surfaces the generic error message instead of a friendly "User already exists" toast.

## Fix

### 1. `supabase/functions/admin-invite-user/index.ts`
- For the "already exists" case, return HTTP **200** with `{ error: "...", code: "user_exists", email }` in the body (instead of 409). This lets the client read the structured error reliably.
- Keep other validation errors as-is (400/401/403 are fine — those are developer/auth issues, not user-facing flow).

### 2. `src/hooks/useUserInvites.ts` (`useCreateUserInvite`)
- When `data?.code === "user_exists"`, throw a clean `Error("A user with this email already exists. Please use a different email.")`.
- Improve fallback: if `error` from `functions.invoke` is a `FunctionsHttpError`, attempt to read the response body for a `.error` field before falling back to the generic message.

### 3. `src/components/admin/...` invite form (if it does inline validation)
- No change needed — the toast from the hook handles it. Only touch the form if a quick check shows the error is being caught locally in a way that hides the toast.

## How to test

1. Go to Admin → Users → Invite user.
2. Enter an email that already belongs to an existing user.
3. Expect a red toast: **"A user with this email already exists. Please use a different email."**
4. Enter a fresh email → invite succeeds as before.
