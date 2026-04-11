# Research: Doctors Portal

**Feature**: 001-doctors-portal  
**Date**: 2026-03-29  
**Purpose**: Resolve all NEEDS CLARIFICATION items and establish best practices for technical decisions.

## Research 1: Authentication Approach

**Task**: Choose between custom lightweight auth vs NextAuth (Auth.js v5) for Next.js 15 App Router.

**Decision**: Custom lightweight auth using API routes

**Rationale**:
- Constitution Principle I prohibits auth provider libraries unless justified. Custom auth is simpler.
- The portal has a small, fixed user base (admin-provisioned doctors). No social login, no OAuth, no SSO needed.
- NextAuth adds significant complexity (adapter pattern, provider config, callback chains, edge runtime constraints) for a use case that only needs email/password.
- Custom auth using existing API route patterns (`app/api/**/route.ts`) is consistent with the project's established architecture.
- Total auth surface is small: login, logout, session check, forgot-password, reset-password — 5 endpoints.

**Alternatives considered**:
- **NextAuth v5**: Too heavy for email-only auth with in-memory storage. Adds ~15+ files of configuration boilerplate. Adapter pattern conflict with in-memory storage.
- **Lucia Auth**: Lighter than NextAuth but still an external dependency. Not justified for 5 endpoints.
- **Passport.js**: Express-oriented, poor fit for Next.js App Router API routes.

## Research 2: Session Management Mechanism

**Task**: Choose between JWT cookies vs server-side sessions for maintaining authenticated state.

**Decision**: JWT in HTTP-only cookie using `jose` library

**Rationale**:
- JWT in an HTTP-only, Secure, SameSite=Lax cookie provides stateless session management.
- `jose` is a lightweight, zero-dependency library for JWT operations that works in both Node.js and Edge Runtime (important for Next.js middleware).
- No server-side session store needed — the JWT contains doctor ID, email, name, role, and expiration.
- 8-hour expiry encoded in the JWT payload matches the spec (FR-007, SC-005).
- HTTP-only cookie prevents XSS access to the token. SameSite=Lax provides CSRF protection while allowing normal navigation.

**Alternatives considered**:
- **Server-side sessions with cookie ID**: Requires in-memory session store management (cleanup, lookup). Adds complexity for no benefit given the small user base and stateless nature of the portal.
- **`jsonwebtoken` library**: Requires Node.js crypto module — doesn't work in Edge Runtime where middleware runs. `jose` works everywhere.
- **Local storage / session storage**: Not HTTP-only, vulnerable to XSS. Rejected for security reasons.

## Research 3: Password Hashing

**Task**: Choose secure password hashing for storing doctor credentials.

**Decision**: `bcryptjs` (pure JavaScript bcrypt implementation)

**Rationale**:
- bcrypt is the industry standard for password hashing with built-in salt and configurable work factor.
- `bcryptjs` is a pure JavaScript implementation — no native bindings, no build-time compilation. Works reliably in Docker (node:22-alpine) without additional system dependencies.
- Cost factor of 10 (default) provides adequate security for the expected user base.
- Small dependency footprint (~50KB), no transitive dependencies.

**Alternatives considered**:
- **`bcrypt` (native)**: Requires `node-gyp` and build tools in Docker. Breaks on Alpine Linux without extra packages. Rejected for deployment complexity.
- **Web Crypto API (PBKDF2/Argon2)**: PBKDF2 is available but bcrypt is more widely understood and has better tooling. Argon2 requires native bindings.
- **`@node-rs/bcrypt`**: Rust-based, faster but adds native dependency.

## Research 4: Route Protection Pattern

**Task**: Determine how to protect `/portal/*` routes from unauthenticated access.

**Decision**: Next.js middleware (`middleware.ts`) at project root

**Rationale**:
- Next.js middleware runs before page rendering on every matched request — ideal for auth guards.
- Middleware can read cookies, verify JWT (using `jose` which works in Edge Runtime), and redirect to `/portal/login` if unauthorized.
- Public portal routes (`/portal/login`, `/portal/forgot-password`, `/portal/reset-password`) are whitelisted in middleware.
- Admin routes (`/portal/admin`) check for admin role in the JWT claims.
- This pattern matches how the sibling prostore-main project handles auth (middleware + auth.config.ts).

**Alternatives considered**:
- **Per-page auth check in layout.tsx**: Works but duplicates logic and runs after rendering starts. Middleware is cleaner.
- **API-only auth check**: Would require client-side redirect on every page load. Worse UX (flash of content, then redirect).

## Research 5: Password Reset Email Integration

**Task**: Determine how to send password reset emails using existing infrastructure.

**Decision**: Extend `lib/email.ts` with a `sendPasswordResetEmail()` function using existing Microsoft Graph integration

**Rationale**:
- The project already has a working Microsoft Graph email integration (`lib/email.ts`) using Azure identity credentials. Verified working for contact form notifications.
- Adding a `sendPasswordResetEmail()` function follows the same `sendMail()` helper pattern.
- Reset link format: `https://jdlab.us/portal/reset-password?token={JWT_RESET_TOKEN}`
- The reset token is a short-lived JWT (1 hour) containing the doctor's ID. Stored in-memory for invalidation of previous tokens.
- User-supplied values in email HTML MUST be escaped (per Constitution Principle V).

**Alternatives considered**:
- **Resend / SendGrid**: Adding another email provider when Microsoft Graph already works. Unnecessary complexity.
- **Magic link (passwordless)**: Simpler UX but changes the auth model fundamentally. Spec explicitly says email/password.

## Research 6: Portal Homepage Content Rendering

**Task**: Determine how to render jdlab.us homepage content within the portal.

**Decision**: Import and render the same section components directly in the portal page

**Rationale**:
- The existing `app/page.tsx` imports 8 section components (Header, Hero, Services, Automation, GlobalReach, Resources, ContactForm, Footer) and renders them sequentially.
- The portal homepage (`app/portal/page.tsx`) will import the same components (Services, Automation, GlobalReach, Resources, ContactForm, Footer) but replace Header with PortalHeader.
- Hero component will be included as-is — it already handles client-side hydration properly.
- ContactForm will receive the doctor's session data as props for pre-filling (FR-011).
- This approach reuses existing components directly (no iframe, no duplication) and keeps rendering server-side where possible.

**Alternatives considered**:
- **iframe embedding**: Introduces CORS issues, double-loading, scroll problems, and breaks the integrated portal experience. Rejected.
- **Duplicating component code**: Violates DRY, creates maintenance burden. Rejected.
- **Client-side fetch of public homepage**: Unnecessary network round-trip for content that's already available as importable components. Rejected.

## Research 7: Admin Authentication

**Task**: Determine how admin accounts are identified and protected.

**Decision**: Admin role encoded in JWT claims, seeded via environment variable or in-memory config

**Rationale**:
- The admin is a JD Lab staff member, not a doctor. The admin account is bootstrapped at startup from environment variables (`PORTAL_ADMIN_EMAIL`, `PORTAL_ADMIN_PASSWORD`).
- When the admin logs in through the same `/portal/login` page, their JWT includes `role: 'admin'`.
- Middleware checks the role claim for `/portal/admin` routes and returns 403 if not admin.
- This avoids a separate admin login flow while still enforcing role-based access.

**Alternatives considered**:
- **Separate admin login page**: Adds UI complexity for one user. The role distinction in JWT is sufficient.
- **Hardcoded admin check by email**: Less flexible. Environment variable approach allows changing admin without code changes.
