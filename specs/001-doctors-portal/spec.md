# Feature Specification: Doctors Portal

**Feature Branch**: `001-doctors-portal`  
**Created**: 2026-03-29  
**Status**: Draft  
**Input**: User description: "I need to create a doctors portal that will let doctors login using their own email accounts. In their homepage they can just see the jdlab.us homepage."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Doctor Logs In to Portal (Priority: P1)

A doctor visits the doctors portal and signs in using their email address. After successful authentication, they are redirected to their portal homepage where they can view the full jdlab.us website content within the portal experience.

**Why this priority**: Without authentication, there is no portal. Login is the gateway to all portal functionality and the core requirement of the feature.

**Independent Test**: Can be fully tested by navigating to the portal login page, entering a valid doctor email, completing authentication, and verifying the portal homepage loads with the jdlab.us content.

**Acceptance Scenarios**:

1. **Given** a doctor with a registered email account, **When** they navigate to the portal login page and enter their email credentials, **Then** they are authenticated and redirected to the portal homepage displaying the jdlab.us website content.
2. **Given** a doctor on the portal login page, **When** they enter an unregistered or invalid email, **Then** they see a clear error message and are not granted access.
3. **Given** a doctor who is already authenticated, **When** they navigate to the portal URL, **Then** they are taken directly to the portal homepage without needing to log in again.

---

### User Story 2 - Doctor Views jdlab.us Homepage in Portal (Priority: P1)

Once logged in, the doctor sees the jdlab.us homepage content rendered within their portal view. The portal provides a branded, authenticated wrapper around the existing public site content so that the doctor's experience feels integrated and personalized.

**Why this priority**: This is the primary value delivered after login — the doctor's homepage IS the jdlab.us content. Without this, the portal has no purpose.

**Independent Test**: Can be fully tested by logging in as a doctor, verifying the portal homepage renders the same content as the public jdlab.us site (hero section, services, automation, global reach, contact form, etc.), and confirming the portal navigation/header is visible.

**Acceptance Scenarios**:

1. **Given** an authenticated doctor on the portal homepage, **When** the page loads, **Then** the full jdlab.us homepage content is displayed (all sections: hero, services, automation, global reach, resources, contact).
2. **Given** an authenticated doctor viewing the portal homepage, **When** they interact with the page (scroll, click sections), **Then** all interactive elements function identically to the public jdlab.us site.
3. **Given** an authenticated doctor on the portal homepage, **When** they look at the page header/navigation, **Then** they see portal-specific elements (their identity, a logout option) distinguishing it from the public site.
4. **Given** an authenticated doctor viewing the contact form on the portal homepage, **When** the form loads, **Then** their name and email fields are pre-filled from their session data.

---

### User Story 3 - Doctor Logs Out of Portal (Priority: P2)

A doctor can securely log out of the portal, ending their session. After logout, they are redirected to the portal login page and cannot access portal content without re-authenticating.

**Why this priority**: Logout is essential for security, especially when doctors may use shared devices in clinical settings, but is secondary to the core login and homepage experience.

**Independent Test**: Can be fully tested by logging in, clicking the logout action, confirming redirect to the login page, and verifying that revisiting the portal homepage redirects to login.

**Acceptance Scenarios**:

1. **Given** an authenticated doctor on any portal page, **When** they click the logout action, **Then** their session is terminated and they are redirected to the login page.
2. **Given** a doctor who has just logged out, **When** they attempt to access the portal homepage directly via URL, **Then** they are redirected to the login page.

---

### User Story 4 — Admin Manages Doctor Accounts (Priority: P2)

A JD Lab administrator logs in to the portal with admin credentials and navigates to the admin page to add or remove doctor accounts. This enables the lab to onboard new partner doctors and revoke access when needed.

**Why this priority**: Doctors cannot use the portal until an admin provisions their account. Required for any multi-user scenario beyond the seed admin, but secondary to the core login/homepage experience.

**Independent Test**: Log in as admin, navigate to /portal/admin, add a doctor, verify the doctor appears in the list, delete a doctor, verify removal.

**Acceptance Scenarios**:

1. **Given** an authenticated admin, **When** they navigate to /portal/admin, **Then** they see a list of all registered doctors (name, email, role, creation date) and a form to add a new doctor.
2. **Given** an admin on the admin page, **When** they submit a valid name, email, and password (≥8 chars), **Then** a new doctor account is created and appears in the list.
3. **Given** an admin on the admin page, **When** they click delete on a doctor, **Then** that doctor's account is removed and they disappear from the list.
4. **Given** an admin on the admin page, **When** they try to create a doctor with an email that already exists, **Then** they see an error message and no duplicate is created.
5. **Given** an admin, **When** they try to delete their own account, **Then** the request is rejected to prevent locking out admin access.
6. **Given** a non-admin doctor, **When** they navigate to /portal/admin, **Then** they are redirected away (middleware denies access).

---

### User Story 5 — Doctor Resets Forgotten Password (Priority: P3)

A doctor who has forgotten their password can request a reset link via email. After clicking the link, they set a new password and can log in again. This self-service flow reduces admin burden for routine password issues.

**Why this priority**: Important for real-world usability when doctors forget passwords, but not required for MVP since admin can always re-create accounts.

**Independent Test**: Navigate to /portal/forgot-password, enter registered email, verify email sent, click reset link, set new password, log in with new password.

**Acceptance Scenarios**:

1. **Given** a doctor on the login page, **When** they click "Forgot Password," **Then** they are taken to a form to enter their email.
2. **Given** a doctor on the forgot-password page, **When** they submit a registered email, **Then** they see a confirmation message ("If an account exists, a reset link has been sent") and receive an email with a reset link.
3. **Given** a doctor on the forgot-password page, **When** they submit an unregistered email, **Then** they see the same confirmation message (no email enumeration).
4. **Given** a doctor who received a reset email, **When** they click the reset link within 1 hour, **Then** they see a form to enter a new password.
5. **Given** a doctor on the reset-password page, **When** they submit a valid new password (≥8 chars), **Then** their password is updated and they see a success message with a link to log in.
6. **Given** a doctor who clicks an expired reset link (>1 hour), **Then** they see a message that the link has expired and are prompted to request a new one.
7. **Given** a doctor who requests multiple password resets, **When** the latest link is sent, **Then** all previous reset links are invalidated.

---

### Edge Cases

- What happens when a doctor's session expires while they are viewing the portal homepage? They should be redirected to the login page with a clear message that their session has expired.
- What happens when a doctor tries to access the portal login page while already authenticated? They should be redirected to the portal homepage.
- What happens when a doctor enters a correctly formatted email that is not registered in the system? They should see an error message indicating access is not authorized.
- What happens when a doctor clicks a password reset link that has already expired? They should see a message that the link has expired and be prompted to request a new one.
- What happens when a doctor requests multiple password resets? Only the most recent reset link should be valid; previous links should be invalidated.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a dedicated login page at the /portal path (e.g., jdlab.us/portal/login), as a subdirectory of the main site.
- **FR-002**: System MUST authenticate doctors using their email accounts (email and password credentials).
- **FR-003**: System MUST restrict portal access to authenticated doctors only — unauthenticated visitors MUST be redirected to the login page.
- **FR-004**: System MUST display the full jdlab.us homepage content as the doctor's portal homepage after successful login.
- **FR-005**: System MUST provide a visible logout mechanism accessible from any portal page.
- **FR-006**: System MUST maintain the doctor's authenticated session across page navigations within the portal.
- **FR-007**: System MUST automatically expire sessions 8 hours after login and redirect the doctor to the login page.
- **FR-008**: System MUST display the doctor's identity (name or email) in the portal header/navigation area.
- **FR-009**: System MUST validate email format on the login form before submission.
- **FR-010**: System MUST provide clear, user-friendly error messages for failed login attempts without revealing whether the email exists in the system.
- **FR-011**: System MUST pre-fill the contact form with the doctor's name and email from their authenticated session when viewing the portal homepage.
- **FR-012**: System MUST provide a simple admin page accessible only to administrators for adding and removing doctor accounts.
- **FR-013**: Admin page MUST allow setting a doctor's name, email, and initial password when creating an account.
- **FR-014**: System MUST provide a "Forgot Password" link on the login page.
- **FR-015**: When a doctor requests a password reset, the system MUST send a temporary reset link to their registered email that expires after a limited time.
- **FR-016**: The password reset flow MUST allow the doctor to set a new password after clicking the valid reset link.

### Key Entities

- **Doctor**: A registered user of the portal. Key attributes: name, email address, role (`doctor` or `admin`). Represents a dental/medical professional who partners with JD Lab. An admin is a Doctor with `role: 'admin'` — not a separate entity.
- **Admin (role)**: A Doctor with the `admin` role. JD Lab staff member who manages doctor accounts. Seeded from environment variables on startup. Has access to the admin page for provisioning doctors.
- **Session**: A temporary authenticated state for a logged-in doctor. Key attributes: doctor reference, creation time, expiration time. Created on login, destroyed on logout or expiration.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Doctors can complete the login process (from visiting the portal to seeing the homepage) in under 30 seconds.
- **SC-002**: 95% of registered doctors successfully log in on their first attempt.
- **SC-003**: The portal homepage displays all sections of the jdlab.us public site without missing content or broken functionality.
- **SC-004**: Unauthorized users are never able to view portal content — 100% of unauthenticated requests are redirected to login.
- **SC-005**: Sessions expire 8 hours after login (fixed-window), and doctors can re-authenticate without issues.

## Clarifications

### Session 2026-03-29

- Q: Session timeout duration? → A: 8 hours (full workday)
- Q: Portal URL entry point? → A: Subdirectory of main site (jdlab.us/portal)
- Q: Portal contact form behavior? → A: Pre-fill doctor's name and email from session
- Q: Doctor account provisioning method? → A: Simple admin page within the portal to add/remove doctors
- Q: Login security / password recovery? → A: Forgot password link with temporary email reset; doctor sets new password

## Assumptions

- Doctors will be registered/provisioned by a JD Lab administrator via a simple admin page within the portal — self-registration is out of scope for this feature.
- The portal is a web application accessible via standard desktop and mobile browsers.
- The jdlab.us homepage content displayed in the portal is the same live content from the existing public site (not a static copy).
- Email/password authentication is sufficient for this feature — multi-factor authentication or SSO integration is out of scope for v1.
- The portal does not modify or extend the jdlab.us homepage functionality — it wraps the existing content within an authenticated experience.
- Doctors have stable internet connectivity to access the portal.
