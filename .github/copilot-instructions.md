# JD Dental Lab - AI Coding Agent Instructions

## Project Overview
Next.js 15 marketing website for a digital dental/medical device lab. Single-page app with sections for services, workflow automation, global reach, and lead generation. All APIs are demo/stub implementations with in-memory storage.

## Architecture

### Component Structure
- **Page Composition**: [app/page.tsx](../app/page.tsx) imports all section components, rendered sequentially on home page
- **Components**: All in `/components`, no nesting. Each is self-contained with inline data
- **Client Components**: Only `Hero.tsx` and `ContactForm.tsx` use `'use client'` for interactivity (scroll, forms)
- **Server Components**: Default for all other components (Header, Services, Automation, GlobalReach, Footer)

### Styling Approach
- **Tailwind-first**: All styling via utility classes, no CSS modules
- **Custom utilities**: Defined in [app/globals.css](../app/globals.css) as `@layer components` (btn-primary, section-padding, container-wide)
- **Color scheme**: Custom colors in [tailwind.config.ts](../tailwind.config.ts) - primary (#0066cc), secondary (#00a699), accent (#ff6b35)
- **Animations**: Custom pulse animations with delay utilities for Hero background orbs

### API Routes Pattern
Located in `app/api/**/route.ts`. All follow this structure:
- **POST**: Primary endpoint with validation, returns success/error JSON
- **GET**: Demo listing endpoint (no auth, in-memory data only)
- **Storage**: In-memory arrays/objects - NOT production-ready, reset on restart
- **Examples**: `/api/contact`, `/api/tracking?caseId=X`, `/api/quote`

## Development Workflow

### Commands
```bash
pnpm dev          # Dev server on :3000
pnpm build        # Production build
pnpm lint         # Next.js linting
pnpm type-check   # TypeScript compilation check
```

### Path Aliases
- `@/*` maps to workspace root (e.g., `@/components/Header`)
- All imports use this alias, never relative paths from `app/`

### Hydration Strategy
- Components using client-side DOM manipulation (like Hero scroll) use `useState`/`useEffect` pattern to avoid SSR/hydration mismatches
- `suppressHydrationWarning` used in layout for client-side variations

## Component Patterns

### Section Components
All follow this structure:
```tsx
export default function SectionName() {
  return (
    <section id="section-id" className="section-padding bg-{color}">
      <div className="container-wide">
        {/* Title block centered */}
        {/* Grid/flex content */}
      </div>
    </section>
  )
}
```

### Data Co-location
- Service cards, automation steps, global stats defined as const arrays inside component
- No separate data files or external JSON
- Icons use emoji characters, not icon libraries

### Form Handling
[ContactForm.tsx](../components/ContactForm.tsx) shows standard pattern:
- Local state for form data + loading + submitted states
- `fetch('/api/contact')` on submit
- Validation in API, not client-side (except HTML5 required)
- Success message with auto-dismiss timeout

## TypeScript Conventions

- Interfaces for API request/response shapes defined in route files
- Strict mode enabled (`strict: true` in tsconfig)
- `NextRequest`/`NextResponse` for API routes
- Type imports with `type` keyword: `import type { Metadata }`

## Metadata & SEO
[app/layout.tsx](../app/layout.tsx) contains all metadata - title, description, keywords, favicons. Update here for SEO changes.

## What NOT to Do
- Don't add state management libraries (no need, forms are simple)
- Don't create API auth/DB layers (demo APIs intentional)
- Don't add CSS files beyond globals.css
- Don't split components into subdirectories
- Don't use `<Link>` for in-page navigation (smooth scroll in Hero shows pattern)
