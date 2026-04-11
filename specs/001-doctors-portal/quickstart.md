# Quickstart: Doctors Portal Development

**Feature**: 001-doctors-portal  
**Branch**: `001-doctors-portal`

## Prerequisites

- Node.js 22+
- pnpm (package manager)
- Git (on branch `001-doctors-portal`)

## Setup

### 1. Install new dependencies

```bash
cd /var/home/admin/IdeaProjects/jdlab-public
pnpm add bcryptjs jose
pnpm add -D @types/bcryptjs
```

### 2. Set environment variables

Add the following to your `.env.local` file (create if it doesn't exist):

```bash
# Portal JWT signing secret (generate a random string)
PORTAL_JWT_SECRET="your-random-secret-at-least-32-characters-long"

# Admin account (seeded on startup)
PORTAL_ADMIN_EMAIL="admin@jdlab.us"
PORTAL_ADMIN_PASSWORD="secureAdminPassword123"
PORTAL_ADMIN_NAME="JD Lab Admin"

# Existing Azure email credentials (already configured if email works)
# AZURE_TENANT_ID=...
# AZURE_CLIENT_ID=...
# AZURE_CLIENT_SECRET=...
```

### 3. Start development server

```bash
pnpm dev
```

### 4. Access the portal

- Portal login: http://localhost:3000/portal/login
- Portal homepage (after login): http://localhost:3000/portal
- Admin page (after admin login): http://localhost:3000/portal/admin
- Public site (unchanged): http://localhost:3000

## Test Flow

1. Navigate to `/portal/login`
2. Log in with admin credentials from `.env.local`
3. Portal homepage should display jdlab.us content with portal header
4. Navigate to `/portal/admin` to add a doctor account
5. Log out, log back in as the new doctor
6. Test forgot-password flow (requires Azure email credentials)

## New Files Created

```
app/portal/layout.tsx
app/portal/page.tsx
app/portal/login/page.tsx
app/portal/forgot-password/page.tsx
app/portal/reset-password/page.tsx
app/portal/admin/page.tsx
app/api/portal/login/route.ts
app/api/portal/logout/route.ts
app/api/portal/session/route.ts
app/api/portal/doctors/route.ts
app/api/portal/doctors/[id]/route.ts
app/api/portal/forgot-password/route.ts
app/api/portal/reset-password/route.ts
components/PortalHeader.tsx
components/PortalLoginForm.tsx
components/PortalAdminForm.tsx
components/PortalForgotPasswordForm.tsx
components/PortalResetPasswordForm.tsx
lib/portal-auth.ts
lib/portal-store.ts
middleware.ts
```

## New Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `bcryptjs` | ^3.0.0 | Password hashing (pure JS, no native deps) |
| `jose` | ^6.0.0 | JWT creation/verification (Edge Runtime compatible) |
| `@types/bcryptjs` | ^3.0.0 | TypeScript types for bcryptjs (dev only) |

## Environment Variables (New)

| Variable | Required | Description |
|----------|----------|-------------|
| `PORTAL_JWT_SECRET` | Yes | Secret key for JWT signing (min 32 chars) |
| `PORTAL_ADMIN_EMAIL` | No | Admin account email (seeded on startup) |
| `PORTAL_ADMIN_PASSWORD` | No | Admin account password (seeded on startup) |
| `PORTAL_ADMIN_NAME` | No | Admin display name (default: "Admin") |
