# Portal Page Contracts

**Feature**: 001-doctors-portal  
**Base Path**: `/portal`

---

## Portal Routes

| Route | Auth Required | Role | Component Type | Description |
|-------|--------------|------|----------------|-------------|
| `/portal` | ✅ Yes | any | Server | Portal homepage — renders jdlab.us sections with portal header |
| `/portal/login` | ❌ No | — | Client | Login form; redirects to `/portal` if already authenticated |
| `/portal/forgot-password` | ❌ No | — | Client | Request password reset email |
| `/portal/reset-password` | ❌ No | — | Client | Set new password (requires valid token in query string) |
| `/portal/admin` | ✅ Yes | admin | Client + Server | Doctor account management page |

## Middleware Route Protection

```
Request → middleware.ts
  ├── /portal/login, /portal/forgot-password, /portal/reset-password
  │     → Allow (public portal routes)
  ├── /portal/admin
  │     → Verify JWT cookie exists AND role === 'admin'
  │     → If invalid → redirect to /portal/login
  │     → If not admin → redirect to /portal (forbidden)
  ├── /portal, /portal/*
  │     → Verify JWT cookie exists and is valid
  │     → If invalid → redirect to /portal/login
  └── All other routes (/, /api/*, /articles/*, etc.)
        → Pass through (no auth check)
```

## Portal Layout Contract

`app/portal/layout.tsx` wraps all portal pages.

**For authenticated pages** (`/portal`, `/portal/admin`):
- Renders `<PortalHeader>` with:
  - JD Lab logo (links to `/portal`)
  - Doctor's name or email
  - "Admin" link (if role === 'admin')
  - Logout button
- Renders `<main>` with page content
- Renders existing `<Footer>` component

**For public pages** (`/portal/login`, `/portal/forgot-password`, `/portal/reset-password`):
- These pages render their own minimal layout (centered form card)
- No portal header (doctor is not authenticated)

## Cookie Contract

| Cookie | Value | HttpOnly | Secure | SameSite | Path | Max-Age |
|--------|-------|----------|--------|----------|------|---------|
| `portal-session` | JWT string | ✅ | ✅ (in production) | Lax | `/` | 28800 (8 hours) |

**JWT payload**:
```json
{
  "sub": "doctor-uuid",
  "email": "doctor@example.com",
  "name": "Dr. Smith",
  "role": "doctor",
  "iat": 1711756800,
  "exp": 1711785600
}
```

**JWT signing**: HMAC-SHA256 with `PORTAL_JWT_SECRET` environment variable.
