# Data Model: Doctors Portal

**Feature**: 001-doctors-portal  
**Date**: 2026-03-29  
**Storage**: In-memory (arrays/objects, resets on restart)

## Entities

### Doctor

Represents a registered user of the portal (dental/medical professional).

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | string | Unique, auto-generated UUID | Primary identifier |
| name | string | Required, max 200 chars | Doctor's display name |
| email | string | Required, unique, valid email format, max 254 chars | Login credential |
| passwordHash | string | Required | bcrypt hash of password (cost factor 10) |
| role | `'doctor' \| 'admin'` | Required, default `'doctor'` | Access level |
| createdAt | string (ISO 8601) | Auto-set on creation | When account was created |

**Validation rules**:
- Email must be unique (case-insensitive comparison)
- Name must be non-empty after trimming, max 200 characters
- Password must be at least 8 characters before hashing
- Email format validated with regex before storage

**Relationships**:
- A Doctor has zero or more PasswordResetTokens (only latest is valid)

### PasswordResetToken

Represents a temporary token for password reset flow.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| token | string | Unique, JWT format | The reset token (short-lived JWT) |
| doctorId | string | Required, references Doctor.id | Which doctor this token is for |
| expiresAt | string (ISO 8601) | Required, 1 hour from creation | When token becomes invalid |
| used | boolean | Default `false` | Whether token has been consumed |

**Validation rules**:
- Only the most recent token for a given doctorId is valid; creating a new token invalidates all previous tokens for that doctor
- Token expires 1 hour after creation
- Token can only be used once (marked `used: true` after successful password reset)

**State transitions**:
```
Created (valid) → Used (consumed, one-time) → Expired (time-based)
                → Invalidated (new token requested)
```

### Session (JWT Claims)

Sessions are stateless — encoded in JWT cookie, not stored server-side.

| Claim | Type | Description |
|-------|------|-------------|
| sub | string | Doctor.id |
| email | string | Doctor.email |
| name | string | Doctor.name |
| role | string | Doctor.role (`'doctor'` or `'admin'`) |
| iat | number | Issued-at timestamp (Unix seconds) |
| exp | number | Expiration timestamp (8 hours after iat) |

**Lifecycle**:
```
Login (credentials valid) → JWT cookie set (8h expiry)
  → Navigation (middleware verifies JWT on each request)
  → Logout (cookie cleared) or Expiry (middleware rejects, redirects to login)
```

## In-Memory Storage Schema

```typescript
// lib/portal-store.ts

interface Doctor {
  id: string
  name: string
  email: string
  passwordHash: string
  role: 'doctor' | 'admin'
  status: 'active' | 'inactive'
  createdAt: string
}

interface PasswordResetToken {
  token: string
  doctorId: string
  expiresAt: string
  used: boolean
}

// Storage arrays
const doctors: Doctor[] = []
const resetTokens: PasswordResetToken[] = []
```

## Seed Data

On server startup, the admin account is bootstrapped from environment variables:

| Variable | Purpose | Example |
|----------|---------|---------|
| `PORTAL_ADMIN_EMAIL` | Admin login email | `admin@jdlab.us` |
| `PORTAL_ADMIN_PASSWORD` | Admin login password | (secure value) |
| `PORTAL_ADMIN_NAME` | Admin display name | `JD Lab Admin` |

If these environment variables are set, an admin account is created in the in-memory store on first import of `portal-store.ts`. If not set, no admin is seeded (graceful degradation).
