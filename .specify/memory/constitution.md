<!--
  Sync Impact Report
  ==================
  Version change: 1.0.0 → 1.1.0 (MINOR — new section added)
  Modified principles: none
  Modified sections:
    - Technology Stack Constraints: expanded Deployment bullet with
      cross-repo detail and container specifics
    - Development Workflow: clarified local vs production distinction
  Added sections:
    - Deployment Architecture (new section between Tech Stack and
      Development Workflow)
  Removed sections: none
  Templates requiring updates:
    - .specify/templates/plan-template.md ✅ no changes needed
      (Constitution Check section references constitution dynamically)
    - .specify/templates/spec-template.md ✅ no changes needed
    - .specify/templates/tasks-template.md ✅ no changes needed
  Follow-up TODOs: none
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

### V. Server-Side Validation

- All input validation MUST happen in API route POST handlers.
- Required-field and format checks (email regex, trimming) MUST
  be performed server-side before processing.
- Client-side validation is limited to HTML5 `required` attributes.
- API responses MUST return structured JSON with appropriate HTTP
  status codes (201 for creation, 400 for bad input, 500 for
  server errors).

**Rationale**: Server-side validation is the authoritative gate;
client hints are a UX convenience, not a security boundary.

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

## Technology Stack Constraints

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

**Version**: 1.1.0 | **Ratified**: 2026-03-28 | **Last Amended**: 2026-03-28
