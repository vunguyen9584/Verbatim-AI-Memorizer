# Authentication Feature – Implementation Plan

This plan adds full authentication and access control to the app with two signup paths:
- Google account sign‑in (OAuth)
- Email sign‑up that collects First name, Surname, Date of birth, and Email, then sends an activation link the user must open to complete sign‑in

Unauthenticated users cannot use any app functions. The app renders an Auth Gate until the user is authenticated.

## Stack & Constraints
- Tech: React 19 + TypeScript + Vite
- i18n: react‑i18next (strings under `src/locales`)
- Backend: Firebase Authentication (already in repo), Firestore for user profile documents
- Existing code: `services/firebaseClient.ts`, `services/authService.ts`, `components/common/SyncStatus.tsx`

Rationale: Firebase Auth already configured; it supports both Google OAuth and Email Link (passwordless) flows that align with “activation link” requirement. Firestore stores user profile data (firstName, lastName, dob) after sign‑in completes.

## Requirements → Design Mapping
1) Google sign‑in
   - Use current `authHelpers.signInWithGoogle()`.
   - On first sign‑in, create a Firestore user profile doc if missing.

2) Email sign‑up with activation link
   - UI form collects: firstName, lastName, dateOfBirth, email.
   - Call `sendSignInLinkToEmail` (activation link). Store the signup payload in `localStorage` keyed by email (e.g., `verbatim_pending_profile:<email>`).
   - On link open, complete sign‑in (`isSignInWithEmailLink` + `signInWithEmailLink`). After Firebase Auth returns a user, write the profile doc to Firestore using the pending data, then clear pending storage.
   - The link is mandatory to sign in; until link completion, user cannot access the app.

3) Gate all features until login
   - Render an `AuthGate` full‑screen overlay when `authService.getUser()` is null. Hide/disable all app features under the gate.

4) Profile persistence
   - Store minimal PII in `users/{uid}`: firstName, lastName, dateOfBirth (ISO), email, provider, createdAt, updatedAt.

## Data Model (Firestore)
Collection: `users`
- id (doc id): `uid` from Firebase Auth
- email: string
- firstName: string
- lastName: string
- dateOfBirth: string (ISO `YYYY-MM-DD`)
- provider: 'google' | 'email-link'
- createdAt: server timestamp
- updatedAt: server timestamp

Optional derived flags (read‑only in UI):
- emailVerified: boolean (from Firebase user, always true for email‑link flow)

## Security Rules (outline)
Ensure each user can only read/write their own profile doc:
```
match /databases/{database}/documents {
  match /users/{userId} {
    allow read, write: if request.auth != null && request.auth.uid == userId;
  }
}
```

## UI/UX Changes
1) AuthGate component (new)
   - Full‑screen panel with two tabs: “Continue with Google” and “Sign up with Email”.
   - Email tab fields: First name, Surname, Date of birth (date picker), Email, Submit.
   - On submit: validate inputs, call `authService.sendEmailLink(email)` and persist pending profile data to `localStorage`.
   - Show success toast “Activation link sent. Check your email.”

2) SyncStatus refinement
   - Keep existing quick actions (Google / Email link) if desired, but primary entry is the AuthGate.
   - When unauthenticated, SyncStatus can display “Sign in required”.

3) App gating
   - In `App.tsx`, subscribe to `authService` (or expose a simple hook). If user is null, render only `<AuthGate />`.

## Services & Logic Changes
1) `services/authService.ts`
   - Keep: `signInWithGoogle`, `sendEmailLink`, `init` (already completes email link sign‑in).
   - Add helper to stash pending profile data:
     - `savePendingProfile(email, data)` and `consumePendingProfile(email)` (use `localStorage`).
   - On auth state change (user logged in): call `userProfileService.ensureUserDocument(user, pendingProfile?)`.

2) `services/userProfileService.ts` (new)
   - `ensureUserDocument({ uid, email, provider }, pending?: { firstName, lastName, dateOfBirth })`
     - If `users/{uid}` exists: no‑op (maybe patch missing fields).
     - Else: create doc with fields and timestamps.

3) `services/firebaseClient.ts`
   - Reuse existing `authHelpers.completeEmailLinkSignIn()`; after completion, `authService` will receive the user and write profile.
   - `actionCodeSettings.url` remains `window.location.origin`; ensure Authorized Domains include the dev origin (see README).

## Flow Details
Email sign‑up:
1. User fills form → click “Send activation link”.
2. UI: `authService.savePendingProfile(email, { firstName, lastName, dateOfBirth })`.
3. Call `authService.sendEmailLink(email)` → toast success.
4. User opens email and clicks the link → app loads with link in URL.
5. `authHelpers.completeEmailLinkSignIn()` runs on startup → Firebase returns authenticated user.
6. `authService` detects user → `userProfileService.ensureUserDocument(...)` using pending profile if present.
7. AuthGate disappears; app becomes usable.

Google sign‑in:
1. User clicks Google → OAuth popup → Firebase returns user.
2. `authService` detects user → `userProfileService.ensureUserDocument(...)` (names can be parsed from provider profile if available).
3. AuthGate disappears.

Sign‑out:
1. User clicks Sign out → `authService.signOut()` → AuthGate shows again.

## i18n & Accessibility
- Add translation keys for AuthGate labels, validation errors, success/error toasts (EN/VI).
- Use semantic form elements and aria labels. Keep Tailwind styling consistent with app.

## Error Handling
- Map Firebase auth errors to friendly messages (similar to `SyncStatus` mapping).
- Validate email format, required fields, and plausible date (>= 13 years old if needed by policy).
- Network failures: show persistent error toast with retry guidance.

## Implementation Steps
1) Backend prep
   - Firebase Console → Authentication → enable Google and Email link (passwordless).
   - Add app origins to Authorized domains.
   - Configure Firestore rules for `users`.

2) Services
   - Add `userProfileService.ts` for profile ensure/upsert.
   - Extend `authService` with pending‑profile helpers and call `ensureUserDocument` on login.

3) UI
   - Build `components/auth/AuthGate.tsx` with Google + Email tabs.
   - Wire `App.tsx` to render `<AuthGate />` when unauthenticated.
   - Optionally simplify unauthenticated controls in `SyncStatus`.

4) Types
   - (Optional) extend `AuthUser` if UI needs more fields; otherwise keep minimal and fetch profile from Firestore when needed.

5) QA
   - Email flow: send link, open on same device (with localStorage email) and on another device (prompt for email), ensure profile creation.
   - Google flow: first‑time and repeat sign‑in.
   - Gating: verify no app action is usable when not authenticated.
   - i18n strings present in EN/VI.

## Estimation
- Services & profile wiring: 0.5–1 day
- AuthGate UI + validation + i18n: 0.5–1 day
- App gating + integration + QA: 0.5 day

## Notes
- Email link equals “activation link” and inherently blocks access until link is opened, satisfying the requirement without password storage.
- For strict DOB handling/compliance, consider storing only YYYY‑MM‑DD and avoiding unnecessary PII elsewhere. Document retention policy as needed.
