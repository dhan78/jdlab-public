# Tasks: Doctors Portal

**Input**: Design documents from `/specs/001-doctors-portal/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Tests**: Not requested in spec — test tasks omitted.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4, US5)

---

## Phase 1: Setup (Project Initialization)

**Purpose**: Install dependencies, configure environment, establish project structure

- [ ] T001 Install bcryptjs, jose, and @types/bcryptjs dependencies via pnpm
- [ ] T002 Create .env.local with PORTAL_JWT_SECRET, PORTAL_ADMIN_EMAIL, PORTAL_ADMIN_PASSWORD, PORTAL_ADMIN_NAME environment variables
- [ ] T003 [P] Create portal directory structure: app/portal/, app/portal/login/, app/portal/forgot-password/, app/portal/reset-password/, app/portal/admin/, app/api/portal/login/, app/api/portal/logout/, app/api/portal/session/, app/api/portal/doctors/, app/api/portal/doctors/[id]/, app/api/portal/forgot-password/, app/api/portal/reset-password/

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core auth infrastructure that ALL user stories depend on — MUST complete before any story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 [P] Implement in-memory storage module with Doctor (without status field — deletion suffices per Principle I) and PasswordResetToken interfaces, doctors array, resetTokens array, and CRUD helper functions (addDoctor, findDoctorByEmail, findDoctorById, removeDoctorById, listDoctors, addResetToken, findValidResetToken, invalidateResetTokensForDoctor, markResetTokenUsed) in lib/portal-store.ts
- [ ] T005 [P] Implement auth utilities module with hashPassword, verifyPassword (bcryptjs), createSessionToken, verifySessionToken, createResetToken, verifyResetToken (jose/JWT), getSessionFromCookies helper, and HTML escape helper for email templates in lib/portal-auth.ts — MUST validate PORTAL_JWT_SECRET env var at module load time and throw a descriptive error if missing (Constitution Principle IX)
- [ ] T006 Implement admin account seeding on first import of lib/portal-store.ts — read PORTAL_ADMIN_EMAIL, PORTAL_ADMIN_PASSWORD, PORTAL_ADMIN_NAME from environment variables and create admin doctor with role 'admin' if env vars are set
- [ ] T007 Create Next.js middleware in middleware.ts — verify JWT cookie on /portal/* routes, whitelist /portal/login, /portal/forgot-password, /portal/reset-password as public, check admin role for /portal/admin, redirect unauthorized to /portal/login?expired=true when JWT is present but expired (vs /portal/login for missing JWT), pass through all non-portal routes

**Checkpoint**: Foundation ready — auth infrastructure, storage, and route protection operational

---

## Phase 3: User Story 1 — Doctor Logs In to Portal (Priority: P1) 🎯 MVP

**Goal**: Doctors can authenticate with email/password and receive a session cookie

**Independent Test**: Navigate to /portal/login, enter valid credentials, verify redirect to /portal with session cookie set

### Implementation for User Story 1

- [ ] T008 [P] [US1] Implement POST /api/portal/login endpoint — validate email/password, verify against portal-store, create JWT session, set HTTP-only cookie (portal-session, 8h, SameSite=Lax, Secure in production), return user info per auth-api contract, include in-memory rate limiting (5 attempts per IP per minute) per Constitution Principle IX in app/api/portal/login/route.ts
- [ ] T009 [P] [US1] Implement GET /api/portal/session endpoint — read portal-session cookie, verify JWT, return authenticated user info or 401 per auth-api contract in app/api/portal/session/route.ts
- [ ] T010 [US1] Create PortalLoginForm client component — email and password fields with HTML5 required, email format validation (FR-009), loading/error/success states with aria-live, submit to /api/portal/login, redirect to /portal on success, "Forgot Password" link to /portal/forgot-password, display session-expired banner when URL contains ?expired=true query param in components/PortalLoginForm.tsx
- [ ] T011 [US1] Create login page — centered card layout, renders PortalLoginForm, redirect to /portal if already authenticated (check cookie in middleware) in app/portal/login/page.tsx

**Checkpoint**: Doctor can log in and receive a valid session — US1 independently functional

---

## Phase 4: User Story 2 — Doctor Views jdlab.us Homepage in Portal (Priority: P1) 🎯 MVP

**Goal**: Authenticated doctors see the full jdlab.us homepage content with a portal-specific header showing their identity

**Independent Test**: Log in as a doctor, verify portal homepage renders all sections (Hero, Services, Automation, GlobalReach, Resources, ContactForm, Footer) with portal header showing name and logout button, and contact form pre-filled with doctor's email

### Implementation for User Story 2

- [ ] T012 [US2] Create PortalHeader client component — JD Lab logo linking to /portal, doctor's name/email display (FR-008), "Admin" link visible only for admin role, logout button (renders as visual element; onClick wired in T017), responsive design using Tailwind, accessible nav landmark with aria labels in components/PortalHeader.tsx
- [ ] T013 [US2] Modify ContactForm to accept optional initialName and initialEmail props — when provided, pre-fill name and email fields from session data (FR-011), keep existing behavior when props not provided in components/ContactForm.tsx
- [ ] T014 [US2] Create portal layout — read session from cookie via verifySessionToken, render PortalHeader for authenticated routes, render children, render Footer, pass session data to context for child components in app/portal/layout.tsx
- [ ] T015 [US2] Create portal homepage — import and render Hero, Services, Automation, GlobalReach, Resources, ContactForm (with pre-filled doctor data), PageBackground, same composition as app/page.tsx but using portal layout with PortalHeader instead of public Header in app/portal/page.tsx

**Checkpoint**: Doctor logs in and sees full jdlab.us content with portal branding — US1 + US2 form the MVP

---

## Phase 5: User Story 3 — Doctor Logs Out of Portal (Priority: P2)

**Goal**: Doctors can securely end their session and are redirected to the login page

**Independent Test**: Log in, click logout, verify redirect to /portal/login, verify /portal redirects back to login

### Implementation for User Story 3

- [ ] T016 [US3] Implement POST /api/portal/logout endpoint — clear portal-session cookie (set Max-Age=0), return success per auth-api contract in app/api/portal/logout/route.ts
- [ ] T017 [US3] Add logout functionality to PortalHeader — on logout button click, POST to /api/portal/logout, redirect to /portal/login on success in components/PortalHeader.tsx

**Checkpoint**: Full login → view → logout cycle works — US1 + US2 + US3 complete

---

## Phase 6: User Story 4 — Admin Manages Doctor Accounts (Priority: P2)

**Goal**: Admin can view, add, and remove doctor accounts through a portal admin page

**Independent Test**: Log in as admin, navigate to /portal/admin, add a new doctor with name/email/password, verify doctor appears in list, delete a doctor, verify removal

### Implementation for User Story 4

- [ ] T018 [P] [US4] Implement GET /api/portal/doctors endpoint — verify admin role from JWT, return list of doctors (excluding passwordHash) with total count per doctors-api contract in app/api/portal/doctors/route.ts
- [ ] T019 [P] [US4] Implement POST /api/portal/doctors endpoint — verify admin role, validate name/email/password (required fields, email format, unique email, min 8 char password), hash password, add to store, return created doctor per doctors-api contract in app/api/portal/doctors/route.ts
- [ ] T020 [P] [US4] Implement DELETE /api/portal/doctors/[id] endpoint — verify admin role, prevent self-deletion, find and remove doctor by ID, return success or 404 per doctors-api contract in app/api/portal/doctors/[id]/route.ts
- [ ] T021 [US4] Create PortalAdminForm client component — form with name, email, password fields for adding doctors, doctors list with delete buttons, loading/error/success states with aria-live, fetch doctors list on mount, submit add to POST /api/portal/doctors, submit delete to DELETE /api/portal/doctors/[id] in components/PortalAdminForm.tsx
- [ ] T022 [US4] Create admin page — verify admin access (middleware handles redirect), render PortalAdminForm in app/portal/admin/page.tsx

**Checkpoint**: Admin can fully manage doctor accounts — US4 independently functional

---

## Phase 7: User Story 5 — Doctor Resets Forgotten Password (Priority: P3)

**Goal**: Doctors who forgot their password can request a reset email, click the link, and set a new password

**Independent Test**: Navigate to /portal/forgot-password, enter registered email, verify email sent (check server logs), click reset link, set new password, log in with new password

### Implementation for User Story 5

- [ ] T023 [US5] Extend lib/email.ts with sendPasswordResetEmail function — accept doctor name, email, and reset token, generate reset URL (https://jdlab.us/portal/reset-password?token={token}), send HTML email via existing Microsoft Graph sendMail helper, HTML-escape all user-supplied values per Constitution Principle V in lib/email.ts
- [ ] T024 [US5] Implement POST /api/portal/forgot-password endpoint — validate email format, look up doctor by email, if found generate reset JWT token (1h expiry) via portal-auth, store in portal-store (invalidate previous tokens for this doctor), send reset email, always return same 200 response regardless of email existence (prevent enumeration per FR-010), include in-memory rate limiting (3 requests per email per hour) per Constitution Principle IX in app/api/portal/forgot-password/route.ts
- [ ] T025 [US5] Implement POST /api/portal/reset-password endpoint — validate token and new password (min 8 chars), verify reset token JWT, check token not expired/used in portal-store, hash new password, update doctor's passwordHash, mark token used, return success per auth-api contract in app/api/portal/reset-password/route.ts
- [ ] T026 [P] [US5] Create PortalForgotPasswordForm client component — email field, submit to POST /api/portal/forgot-password, success message ("If an account exists, a reset link has been sent"), error handling, link back to /portal/login, aria-live for status in components/PortalForgotPasswordForm.tsx
- [ ] T027 [P] [US5] Create PortalResetPasswordForm client component — read token from URL query params, new password and confirm password fields, submit to POST /api/portal/reset-password, success message with link to /portal/login, expired token error handling, aria-live for status in components/PortalResetPasswordForm.tsx
- [ ] T028 [US5] Create forgot-password page — centered card layout, renders PortalForgotPasswordForm in app/portal/forgot-password/page.tsx
- [ ] T029 [US5] Create reset-password page — centered card layout, renders PortalResetPasswordForm, pass token from searchParams in app/portal/reset-password/page.tsx

**Checkpoint**: Full password reset cycle works — forgot → email → reset → login with new password

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final improvements affecting multiple user stories

- [ ] T030 [P] Add accessible form labels, aria-live regions, keyboard navigation, and visible focus indicators across all portal form components per Constitution Principle VII
- [ ] T031 [P] Validate all API endpoints enforce field-length limits (name ≤ 200 chars, email ≤ 254 chars, password ≤ 128 chars, message fields per existing limits) per Constitution Principle V
- [ ] T032 Run pnpm build to verify production build succeeds with all portal routes
- [ ] T033 Run quickstart.md validation — follow the test flow end-to-end to verify all portal functionality, AND verify public homepage (/) still renders ContactForm correctly without portal props (regression check)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup (Phase 1) — BLOCKS all user stories
- **US1 Login (Phase 3)**: Depends on Foundational (Phase 2) — no story dependencies
- **US2 Homepage (Phase 4)**: Depends on Foundational (Phase 2) — integrates with US1 for full flow but independently testable
- **US3 Logout (Phase 5)**: Depends on US2 (needs PortalHeader component from T012)
- **US4 Admin (Phase 6)**: Depends on Foundational (Phase 2) — no story dependencies
- **US5 Password Reset (Phase 7)**: Depends on Foundational (Phase 2) — no story dependencies
- **Polish (Phase 8)**: Depends on all user stories complete

### User Story Dependencies

- **US1 (Login)**: Independent — can start after Phase 2
- **US2 (Homepage)**: Independent — can start after Phase 2 (uses US1 login for testing but not for implementation)
- **US3 (Logout)**: Depends on US2 (PortalHeader component)
- **US4 (Admin)**: Independent — can start after Phase 2
- **US5 (Password Reset)**: Independent — can start after Phase 2

### Within Each User Story

- API endpoints before UI components
- Models/services before page components
- Core implementation before integration points

### Parallel Opportunities

**After Phase 2 completes, the following can run in parallel:**
- US1 (Login endpoints + form) ‖ US4 (Admin endpoints + form) ‖ US5 (Password reset endpoints + forms)
- US2 starts once PortalHeader is needed (or in parallel if PortalHeader is built first)

---

## Parallel Example: After Foundational Phase

```bash
# These can all run in parallel (different files, no dependencies):
T008: "POST /api/portal/login in app/api/portal/login/route.ts"
T009: "GET /api/portal/session in app/api/portal/session/route.ts"
T018: "GET /api/portal/doctors in app/api/portal/doctors/route.ts"
T024: "POST /api/portal/forgot-password in app/api/portal/forgot-password/route.ts"
T025: "POST /api/portal/reset-password in app/api/portal/reset-password/route.ts"
```

## Parallel Example: US5 Form Components

```bash
# These can run in parallel (different files):
T026: "PortalForgotPasswordForm in components/PortalForgotPasswordForm.tsx"
T027: "PortalResetPasswordForm in components/PortalResetPasswordForm.tsx"
```

---

## Implementation Strategy

### MVP First (US1 + US2 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks everything)
3. Complete Phase 3: US1 — Doctor Login
4. Complete Phase 4: US2 — Portal Homepage
5. **STOP and VALIDATE**: Doctor can log in and see jdlab.us content in portal
6. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Infrastructure ready
2. US1 (Login) → Can authenticate ✅
3. US2 (Homepage) → Full portal experience ✅ **← MVP milestone**
4. US3 (Logout) → Secure session management ✅
5. US4 (Admin) → Doctor provisioning ✅
6. US5 (Password Reset) → Self-service recovery ✅
7. Polish → Production-quality ✅

---

## Notes

- All components in flat `/components` directory per constitution
- All API routes follow existing project pattern (NextRequest/NextResponse)
- In-memory storage resets on server restart — seed admin from env vars
- JWT cookie `portal-session` is separate from any future auth cookies
- ContactForm modification (T013) must maintain backward compatibility with public site
- Commit after each task or logical group
