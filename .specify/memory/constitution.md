<!--
  Sync Impact Report
  ==================
  Version change: 1.1.0 → 2.0.0 (MAJOR — new mandatory principles added)

  Modified principles:
    - V. Server-Side Validation → V. Input Validation & Sanitization
      (expanded to mandate HTML-escape of user input in email
      templates, field-length limits, and type-checked runtime
      validation on API payloads)

  Added principles:
    - VII. Accessibility (a11y) Baseline — WCAG 2.1 AA compliance,
      semantic landmarks, ARIA attributes, keyboard navigation
    - VIII. SEO & Social Metadata — Open Graph, Twitter Card,
      canonical URL, structured data (JSON-LD)
    - IX. Security Hardening — rate limiting, no PII exposure on
      GET endpoints, Content-Security-Policy headers, XSS
      prevention in server-generated HTML

  Added sections: none (principles added within Core Principles)
  Removed sections: none

  Templates requiring updates:
    - .specify/templates/plan-template.md ✅ no changes needed
      (Constitution Check references constitution dynamically)
    - .specify/templates/spec-template.md ✅ no changes needed
    - .specify/templates/tasks-template.md ✅ no changes needed

  Follow-up TODOs:
    - Implement fixes for audit findings (see summary below)
    - Existing code has violations against the new principles;
      a remediation pass is required.
-->

# JD Dental Lab Constitution

## Core Principles

### I. Simplicity & Minimalism (NON-NEGOTIABLE)

Every decision MUST favor the simplest viable approach:
- YAGNI: features, abstractions, and libraries MUST NOT be added
  speculatively or for hypothetical future requirements.
- No state management libraries (Redux, Zustand, etc.) — form
  state via `useState` is sufficient.
- No form validation libraries (react-hook-form, formik) — HTML5
  `required` attributes plus server-side validation only.
- No icon libraries — emoji characters (🦷🔧📐) MUST be used.
- Data arrays MUST be inlined within the component that uses them;
  no external JSON files or shared data modules.
- APIs are demo implementations with in-memory storage. No database
  or authentication MUST be added unless the project scope changes.

**Rationale**: The site is a marketing/lead-generation page. Minimal
dependencies reduce build size, maintenance burden, and onboarding
friction. Complexity MUST be justified against this baseline.

### II. Tailwind-Only Styling

- All styling MUST use Tailwind CSS utility classes.
- CSS modules, styled-components, and arbitrary inline styles
  MUST NOT be used (exception: dynamic backgrounds requiring
  computed values).
- Custom reusable utilities (`.btn-primary`, `.section-padding`,
  `.container-wide`) MUST be defined in `app/globals.css` via
  `@apply`.
- Theme colors (`primary`, `secondary`, `accent`) MUST be sourced
  from `tailwind.config.ts`, never hardcoded in components.

**Rationale**: A single styling system eliminates context-switching,
ensures design consistency, and keeps the bundle lean.

### III. Server Components by Default

- Components MUST be React Server Components unless they require
  browser APIs, event handlers, or client-side state.
- The `'use client'` directive MUST only appear when DOM interaction
  or React hooks demand it (current exceptions: `Hero.tsx`,
  `ContactForm.tsx`).
- Hydration mismatches MUST be handled via the `isClient` pattern:
  `useState(false)` + `useEffect(() => setIsClient(true), [])`,
  gating animated or browser-dependent JSX behind the flag.
- `suppressHydrationWarning` MUST be set on `<html>` and `<body>`
  in `layout.tsx`.

**Rationale**: Server Components reduce client JS, improve TTFB,
and simplify reasoning about data flow.

### IV. Co-located Data & Types

- TypeScript interfaces MUST be defined in the file that uses them
  (e.g., `interface ContactRequest` in `route.ts`).
- Component data (service lists, workflow steps) MUST be declared
  as `const` arrays inside the component file.
- Type-only imports MUST use `import type { ... }`.

**Rationale**: Co-location keeps related code together, reduces
indirection, and makes components self-contained.

### V. Input Validation & Sanitization

- All input validation MUST happen in API route POST handlers.
- Required-field and format checks (email regex, trimming) MUST
  be performed server-side before processing.
- Field-length limits MUST be enforced (e.g., name ≤ 200
  characters, message ≤ 5 000 characters) to prevent oversized
  payloads and email bodies.
- Numeric fields (quantity, price) MUST be validated as the
  correct type and range at runtime (not just via TypeScript
  interfaces, which are erased at build time).
- User-supplied values interpolated into HTML (e.g., email
  templates) MUST be escaped to prevent XSS. Use a dedicated
  escape helper; never use raw template-literal interpolation for
  untrusted data in HTML contexts.
- Client-side validation is limited to HTML5 `required` attributes.
- API responses MUST return structured JSON with appropriate HTTP
  status codes (201 for creation, 400 for bad input, 500 for
  server errors).

**Rationale**: Server-side validation is the authoritative gate;
client hints are a UX convenience, not a security boundary.
Template-literal injection in HTML emails is a real XSS vector in
some email clients and MUST be defended against.

### VI. Flat Architecture

- All components MUST reside in a flat `/components` directory —
  no subdirectories or nesting.
- The single-page layout in `app/page.tsx` MUST import section
  components and render them sequentially.
- In-page navigation MUST use smooth scrolling
  (`scrollIntoView({ behavior: 'smooth' })`), not `<Link>`.
- Import paths MUST use the `@/*` alias mapped to the workspace
  root; relative imports from `app/` MUST NOT be used.

**Rationale**: Flat structure matches the single-page scope and
keeps navigation trivial for contributors.

### VII. Accessibility (a11y) Baseline

All pages MUST meet WCAG 2.1 Level AA. Specifically:

- Every page MUST contain exactly one `<main>` landmark wrapping
  the primary content region.
- Interactive elements (`<button>`, `<a>`, custom controls) MUST
  have accessible names — via visible text, `aria-label`, or
  `aria-labelledby`.
- Toggles (e.g., mobile menu hamburger) MUST expose
  `aria-expanded` reflecting their open/closed state.
- Buttons that do not submit forms MUST have `type="button"`.
- Emoji used as meaningful content MUST be wrapped in a
  `<span role="img" aria-label="description">` or equivalent.
- Form status changes (success, error, loading) MUST be announced
  to assistive technology via `role="alert"`, `aria-live`, or
  `aria-busy` as appropriate.
- All interactive elements MUST be keyboard-reachable (`tabIndex`,
  `onKeyDown`) and have visible focus indicators.
- Form inputs MUST have associated `<label>` elements (already
  followed — MUST remain enforced).

**Rationale**: Accessibility is a legal requirement in many
jurisdictions and a core quality signal. A marketing site that
cannot be navigated by keyboard or screen reader excludes a
significant portion of potential customers.

### VIII. SEO & Social Metadata

- `app/layout.tsx` MUST export Next.js `metadata` including at
  minimum: `title`, `description`, `keywords`, `openGraph`
  (`title`, `description`, `url`, `siteName`, `images`, `type`),
  and `twitter` (`card`, `title`, `description`, `images`).
- A canonical URL MUST be set via `metadata.alternates.canonical`.
- Structured data (JSON-LD) for `Organization` or `LocalBusiness`
  SHOULD be included in `layout.tsx` or `page.tsx` for rich
  search results.
- Heading hierarchy MUST NOT skip levels (h1 → h2 → h3).
- Dynamic content (copyright year, dates) MUST NOT be hardcoded;
  derive from `new Date().getFullYear()` or equivalent.

**Rationale**: The site exists to attract leads via search and
social sharing. Missing Open Graph tags produce blank previews on
LinkedIn, Facebook, and messaging apps — directly reducing
inbound traffic.

### IX. Security Hardening

- API GET endpoints MUST NOT expose personally identifiable
  information (PII) such as emails, phone numbers, or messages
  without authentication. Demo listing endpoints MUST return
  aggregate counts only, or be removed.
- API POST endpoints SHOULD implement rate limiting (e.g., via
  an in-memory counter or middleware) to prevent spam and quota
  exhaustion on external services (Azure Graph API).
- Security headers MUST be configured in `next.config.ts`
  (`headers()` function) or Caddy: `Content-Security-Policy`,
  `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: SAMEORIGIN`,
  `Referrer-Policy: strict-origin-when-cross-origin`.
- Environment variables for secrets MUST be validated at startup
  with a clear error message; non-null assertions (`!`) on
  `process.env` MUST be replaced with an explicit check or
  default.
- Unused production dependencies MUST be removed from
  `package.json` (e.g., `axios` is currently unused).

**Rationale**: Even a demo/marketing site handles real user data
via the contact form. Exposing PII on unauthenticated endpoints
and allowing unlimited submissions are exploitable weaknesses
that erode trust.

- **Framework**: Next.js 15 (App Router), React 19, TypeScript
  (strict mode).
- **Styling**: Tailwind CSS 3.4 with custom theme in
  `tailwind.config.ts`.
- **Package manager**: pnpm (preferred); lockfile MUST be committed.
- **Runtime**: Node.js 22 (Docker base image `node:22-alpine`).
- **Build output**: Next.js standalone mode via multi-stage Docker
  build (`Dockerfile` in this repo).
- **APIs**: Next.js API routes (`app/api/**/route.ts`) with
  in-memory storage only.
- **Prohibited additions** (unless scope explicitly changes):
  databases, auth providers, state management libraries, CSS
  preprocessors, icon libraries, form libraries.

## Deployment Architecture

This project is deployed as a Docker container on an AWS EC2
instance alongside a sibling application (Prostore). Deployment
orchestration lives in the **prostore-main** repository, not here.

### Production topology (single EC2 host)

| Container | Image | Domain | Port |
|-----------|-------|--------|------|
| `jdlab-nextjs` | `ghcr.io/dhan78/jdlab:latest` | `jdlab.us` | 3000 |
| `prostore-app` | `ghcr.io/dhan78/prostore:latest` | `shop.jdlab.us` | 3000 |
| `postgres-prostore` | `postgres:18.3` | — | 5432 |
| `caddy` | `caddy:2-alpine` | — | 80/443 |

### Reverse proxy

Caddy 2 terminates TLS (auto-HTTPS via Let's Encrypt) and routes
traffic by hostname:
- `jdlab.us` → `jdlab-nextjs:3000`
- `shop.jdlab.us` → `prostore-app:3000`
- `www.jdlab.us` → permanent redirect to `jdlab.us`
- HTTP/3 (QUIC) is enabled on port 443/udp.

### Image registry & build pipeline

- Images are published to GitHub Container Registry (GHCR) under
  the `dhan78` namespace.
- The `build-and-push.sh` script in **prostore-main** builds both
  the jdlab and prostore images locally (via Podman) and pushes
  them to GHCR.
- jdlab image is built from `../jdlab-public/Dockerfile` relative
  to prostore-main.
- Tags default to `latest`; a custom tag can be passed as an
  argument.

### Deployment scripts (in prostore-main)

- `build-and-push.sh` — build both images, push to GHCR.
- `ec2-deploy.sh` — pull latest images from GHCR, stop containers,
  start services, run Prostore DB migrations.
- `docker-compose.prod.yml` — production Compose file pulling
  pre-built GHCR images for both sites.
- `Caddyfile` (in prostore-main) — routes both `jdlab.us` and
  `shop.jdlab.us`.

### Resource constraints

- The `jdlab-nextjs` container is limited to **256 MB** memory
  (128 MB reserved).
- The container runs as non-root user `nextjs` (UID 1001).
- A health check (`wget` to `localhost:3000`) is configured in the
  Dockerfile with 30s interval.

### Cross-repo rules

- Changes to the jdlab `Dockerfile`, exposed ports, or container
  name MUST be coordinated with `docker-compose.prod.yml` and
  `Caddyfile` in the prostore-main repo.
- The local `docker-compose.yml` and `Caddyfile` in this repo are
  for standalone local development/testing only and MUST NOT be
  used in production.
- `pnpm build` MUST succeed before any image build — the Docker
  build stage runs `pnpm build` inside the container.

## Development Workflow

### Local development

- `pnpm dev` — local development server with Turbopack on :3000.
- `pnpm build` — production build; MUST pass before any deploy.
- `pnpm lint` — ESLint for Next.js + TypeScript; MUST pass clean.
- `pnpm type-check` — `tsc --noEmit`; MUST pass clean.
- `docker-compose.yml` (this repo) — standalone local environment
  with Caddy; for quick container testing without prostore.

### Code conventions

- New section components MUST follow the section template pattern
  documented in `.github/copilot-instructions.md` (centered title
  block → grid/flex content inside `.container-wide`).
- SEO metadata is managed exclusively in `app/layout.tsx`.
- Favicons are generated via ImageMagick from source PNGs in
  `/public`.

### Production deployment

- Trigger from the prostore-main repo:
  `./build-and-push.sh [tag]` then `./ec2-deploy.sh` on EC2.
- MUST verify `pnpm build` passes locally before pushing an image.
- After deploying, verify the health check endpoint responds at
  `https://jdlab.us`.

## Governance

This constitution is the authoritative reference for architectural
and coding decisions in the JD Dental Lab project. It supersedes
ad-hoc conventions when conflicts arise.

- **Amendments**: Any change to a Core Principle MUST be documented
  with rationale, reflected in this file, and kept in sync with
  `.github/copilot-instructions.md`.
- **Versioning**: Follows semantic versioning — MAJOR for principle
  removals or incompatible redefinitions, MINOR for new principles
  or material expansions, PATCH for clarifications and wording.
- **Compliance**: All feature work (specs, plans, tasks) MUST pass
  a Constitution Check gate verifying alignment with these
  principles before implementation begins.

**Version**: 2.0.0 | **Ratified**: 2026-03-28 | **Last Amended**: 2026-03-28
