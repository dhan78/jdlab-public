# API Contracts: Doctor Management (Admin)

**Feature**: 001-doctors-portal  
**Base Path**: `/api/portal/doctors`  
**Authorization**: Admin role required (JWT claim `role: 'admin'`)

---

## GET `/api/portal/doctors`

List all registered doctors. Admin only.

**Request**: No body. Admin session identified by cookie.

**Success Response** (200):
```json
{
  "doctors": [
    {
      "id": "uuid",
      "name": "Dr. Smith",
      "email": "doctor@example.com",
      "role": "doctor",
      "status": "active",
      "createdAt": "2026-03-29T10:00:00.000Z"
    }
  ],
  "total": 1
}
```
*Note: `passwordHash` is NEVER included in responses.*

**Error Responses**:
- 401: `{ "error": "Authentication required" }`
- 403: `{ "error": "Admin access required" }`

---

## POST `/api/portal/doctors`

Create a new doctor account. Admin only.

**Request**:
```json
{
  "name": "Dr. Jane Doe",
  "email": "jane@example.com",
  "password": "initialPassword123"
}
```

**Validation**:
- `name`: required, non-empty after trim, max 200 chars
- `email`: required, valid email format, max 254 chars, unique (case-insensitive)
- `password`: required, minimum 8 characters

**Success Response** (201):
```json
{
  "success": true,
  "doctor": {
    "id": "uuid",
    "name": "Dr. Jane Doe",
    "email": "jane@example.com",
    "role": "doctor",
    "status": "active",
    "createdAt": "2026-03-29T10:00:00.000Z"
  }
}
```

**Error Responses**:
- 400: `{ "error": "Name, email, and password are required" }`
- 400: `{ "error": "Password must be at least 8 characters" }`
- 400: `{ "error": "Invalid email format" }`
- 409: `{ "error": "A doctor with this email already exists" }`
- 401: `{ "error": "Authentication required" }`
- 403: `{ "error": "Admin access required" }`

---

## DELETE `/api/portal/doctors/[id]`

Remove a doctor account. Admin only.

**URL Parameter**:
- `id`: Doctor UUID

**Request**: No body. Admin session identified by cookie.

**Success Response** (200):
```json
{
  "success": true,
  "message": "Doctor account removed"
}
```

**Error Responses**:
- 401: `{ "error": "Authentication required" }`
- 403: `{ "error": "Admin access required" }`
- 403: `{ "error": "Cannot delete your own admin account" }`
- 404: `{ "error": "Doctor not found" }`
