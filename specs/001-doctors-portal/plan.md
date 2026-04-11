# Implementation Plan: Doctors Portal

**Branch**: `001-doctors-portal` | **Date**: 2026-03-29 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-doctors-portal/spec.md`

## Summary

Build an authenticated doctors portal at `/portal` within the existing jdlab.us Next.js application. Doctors log in with email/password, view the jdlab.us homepage content in an authenticated wrapper with portal-specific header (identity display, logout). Includes admin page for doctor account management and forgot-password flow via existing Microsoft Graph email infrastructure. Uses custom lightweight auth with in-memory storage (matching project conventions), bcryptjs for password hashing, and JWT cookies for sessions.

## Technical Context

**Language/Version**: TypeScript (strict mode), Next.js 15 (App Router), React 19  
**Primary Dependencies**: Next.js 15, React 19, bcryptjs (new — password hashing), jose (new — JWT tokens)  
**Storage**: In-memory arrays/objects (matching existing API pattern); resets on restart  
**Testing**: Manual testing (no test framework in project currently)  
**Target Platform**: Docker container (node:22-alpine) on AWS EC2, Caddy reverse proxy  
**Project Type**: Web service (marketing site extended with authenticated portal)  
**Performance Goals**: Login < 30 seconds end-to-end (SC-001); all portal pages render same speed as public site  
**Constraints**: In-memory storage only (constitution); 8-hour session timeout; no external auth providers  
**Scale/Scope**: Small number of doctors (admin-provisioned); single portal homepage + login + admin + password reset pages

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Design Gate (before Phase 0)

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Simplicity & Minimalism | ⚠️ VIOLATION — JUSTIFIED | Adding authentication + 2 new dependencies (bcryptjs, jose). Constitution permits this: "unless the project scope changes." The doctors portal IS a scope change. |
| I. Prohibited additions | ⚠️ VIOLATION — JUSTIFIED | Auth is a "prohibited addition unless scope explicitly changes." Portal feature explicitly changes scope. No database added — using in-memory storage. No auth provider library (NextAuth) — using custom lightweight auth. |
| II. Tailwind-Only Styling | ✅ PASS | All portal UI will use Tailwind utilities and existing custom classes. |
| III. Server Components by Default | ✅ PASS | Only login form, admin form, and password reset form need `'use client'`. Portal homepage and layout are server components. |
| IV. Co-located Data & Types | ✅ PASS | All types defined in the files that use them. |
| V. Input Validation & Sanitization | ✅ PASS | All validation server-side in API route handlers. Field-length limits enforced. Password reset tokens escaped in email HTML. |
| VI. Flat Architecture | ✅ PASS | All new components in flat `/components` directory. Portal routes in `app/portal/` (routing, not component organization). |
| VII. Accessibility Baseline | ✅ PASS | Portal pages will follow WCAG 2.1 AA: semantic landmarks, accessible form labels, aria-live for status changes, keyboard navigation. |
| VIII. SEO & Social Metadata | ✅ N/A | Portal pages are behind auth — not indexed by search engines. |
| IX. Security Hardening | ✅ PASS | No PII on GET endpoints; rate limiting on login; HTTP-only secure cookies; password hashing; CSRF protection via SameSite cookie. |

**Gate Result**: PASS (2 justified violations documented in Complexity Tracking below)

## Project Structure

### Documentation (this feature)

```text
specs/001-doctors-portal/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (API contracts)
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
app/
├── portal/
│   ├── layout.tsx                  # Portal layout (auth check, portal header)
│   ├── page.tsx                    # Portal homepage (renders jdlab.us sections)
│   ├── login/
│   │   └── page.tsx                # Login form page
│   ├── forgot-password/
│   │   └── page.tsx                # Forgot password request page
│   ├── reset-password/
│   │   └── page.tsx                # Set new password page
│   └── admin/
│       └── page.tsx                # Doctor account management page
├── api/
│   └── portal/
│       ├── login/route.ts          # POST: authenticate doctor
│       ├── logout/route.ts         # POST: end session
│       ├── session/route.ts        # GET: check current session
│       ├── doctors/route.ts        # GET/POST: list/add doctors (admin)
│       ├── doctors/[id]/route.ts   # DELETE: remove doctor (admin)
│       ├── forgot-password/route.ts # POST: request reset email
│       └── reset-password/route.ts  # POST: set new password with token

components/
├── PortalHeader.tsx                # Portal header (identity, logout, nav)
├── PortalLoginForm.tsx             # Login form (client component)
├── PortalAdminForm.tsx             # Add doctor form (client component)
├── PortalForgotPasswordForm.tsx    # Forgot password form (client component)
├── PortalResetPasswordForm.tsx     # Reset password form (client component)

lib/
├── portal-auth.ts                  # Auth utilities (hash, verify, JWT, session helpers)
├── portal-store.ts                 # In-memory storage (doctors, sessions, reset tokens)
├── email.ts                        # (existing) Extended with password reset email

middleware.ts                       # (new) Next.js middleware for /portal/* route protection
```

**Structure Decision**: Single Next.js application extended with `/portal` route group. All portal components in flat `/components` directory (per constitution). API routes under `/api/portal/` namespace to avoid conflicts with existing APIs. New `lib/` modules for auth utilities and in-memory storage. Next.js middleware for route protection.

## Complexity Tracking

> Justified violations from Constitution Check

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Adding authentication (Principle I) | Doctors portal requires login — this is the core feature. Constitution explicitly allows this when "scope changes." | No-auth portal would not meet FR-002/FR-003 requirements. |
| Adding bcryptjs + jose dependencies (Principle I) | Secure password hashing and JWT session tokens are non-negotiable for auth. | Plain-text passwords violate security principles. Rolling own crypto is worse. Built-in Web Crypto API lacks bcrypt. |
| Multi-page navigation with `<Link>` (Principle VI) | Portal has distinct pages (login, homepage, admin, reset-password) requiring Next.js routing. | Single-page smooth scroll is inappropriate for auth flows that require separate URL paths and server-side route protection. |
