# Staff Manager — Project Onboarding

**1. Why does the auth gate in proxy.ts re-verify the token against Supabase on every request instead of trusting the session cookie directly?**
- A. The lighter-weight cookie check is deprecated in this Supabase SDK version
- B. Trusting an unverified cookie would let a forged or stale session pass the gate; the token must be validated server-side
- C. It's faster because it avoids a network call
- D. It doesn't matter, both approaches are interchangeable in this codebase

**2. Why do RLS policies use SECURITY DEFINER helper functions like get_my_role() instead of querying collaborators directly inside the policy?**
- A. Performance — helper functions are cached
- B. A self-referencing subquery on collaborators inside its own RLS policy causes infinite recursion
- C. Supabase doesn't allow direct table queries inside RLS policies at all
- D. It's a stylistic convention with no functional reason

*(Answers: 1-B, 2-B)*
