# API Contracts: Portal Authentication

**Feature**: 001-doctors-portal  
**Base Path**: `/api/portal`

---

## POST `/api/portal/login`

Authenticate a doctor with email and password.

**Request**:
```json
{
  "email": "doctor@example.com",
  "password": "securepassword"
}
```

**Validation**:
- `email`: required, valid email format, max 254 chars, trimmed
- `password`: required, non-empty

**Success Response** (200):
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "name": "Dr. Smith",
    "email": "doctor@example.com",
    "role": "doctor"
  }
}
```
*Sets HTTP-only cookie `portal-session` with JWT (8h expiry).*

**Error Responses**:
- 400: `{ "error": "Email and password are required" }`
- 401: `{ "error": "Invalid email or password" }` (generic — does not reveal which field is wrong per FR-010)
- 429: `{ "error": "Too many login attempts. Try again later." }` (rate limit: 5 attempts/IP/minute)

---

## POST `/api/portal/logout`

End the doctor's session.

**Request**: No body required. Session identified by cookie.

**Success Response** (200):
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```
*Clears `portal-session` cookie.*

---

## GET `/api/portal/session`

Check current session status. Used by client components to get user info.

**Request**: No body. Session identified by cookie.

**Success Response** (200):
```json
{
  "authenticated": true,
  "user": {
    "id": "uuid",
    "name": "Dr. Smith",
    "email": "doctor@example.com",
    "role": "doctor"
  }
}
```

**Error Response** (401):
```json
{
  "authenticated": false
}
```

---

## POST `/api/portal/forgot-password`

Request a password reset email.

**Request**:
```json
{
  "email": "doctor@example.com"
}
```

**Validation**:
- `email`: required, valid email format, max 254 chars, trimmed

**Success Response** (200):
```json
{
  "success": true,
  "message": "If an account with that email exists, a reset link has been sent."
}
```
*Always returns 200 with the same message regardless of whether the email exists (prevents email enumeration per FR-010).*

*If email exists: sends reset email via Microsoft Graph with link to `/portal/reset-password?token={JWT}`.*

---

## POST `/api/portal/reset-password`

Set a new password using a valid reset token.

**Request**:
```json
{
  "token": "jwt-reset-token",
  "password": "newSecurePassword"
}
```

**Validation**:
- `token`: required, non-empty
- `password`: required, minimum 8 characters

**Success Response** (200):
```json
{
  "success": true,
  "message": "Password has been reset successfully. You can now log in."
}
```

**Error Responses**:
- 400: `{ "error": "Token and new password are required" }`
- 400: `{ "error": "Password must be at least 8 characters" }`
- 400: `{ "error": "Invalid or expired reset link. Please request a new one." }`
