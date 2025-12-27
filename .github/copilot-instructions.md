# JD Dental Lab - AI Coding Agent Instructions

## Project Overview
Next.js 15 single-page marketing site for digital dental/medical device lab. Focus: services showcase, workflow automation, global reach, lead generation. All APIs are demo implementations with in-memory storage.

## Architecture

### Page Structure
- **Single-page app**: [app/page.tsx](../app/page.tsx) imports 8 section components rendered sequentially
- **Global background**: `<PageBackground />` renders fixed decorative elements (SVG patterns, gradient orbs)
- **Component location**: All in `/components` flat directory, no nesting
- **Client vs Server**: Only `Hero.tsx` and `ContactForm.tsx` are `'use client'` (DOM interaction, forms). All others are server components.

### Styling Architecture
- **Tailwind-only**: No CSS modules, inline styles only for dynamic backgrounds
- **Custom utilities** in [app/globals.css](../app/globals.css):
  - `.btn-primary`, `.btn-secondary` - button styles
  - `.section-padding` - consistent vertical spacing (py-16 + px-4/6/8)
  - `.container-wide` - max-w-7xl mx-auto content wrapper
- **Colors** in [tailwind.config.ts](../tailwind.config.ts): `primary` (#0066cc blue), `secondary` (#00a699 teal), `accent` (#ff6b35 orange)
- **Animations**: Custom `animate-pulse` with `.animation-delay-2000` / `.animation-delay-4000` utilities for staggered effects

### API Routes (`app/api/**/route.ts`)
**Pattern for all APIs**:
```typescript
// POST: main endpoint with validation
export async function POST(request: NextRequest) {
  const body = await request.json()
  // Validate, process, return NextResponse.json()
}

// GET: demo listing (no auth required)
export async function GET() {
  return NextResponse.json(inMemoryData)
}
```
- **Storage**: In-memory arrays/objects only - resets on restart
- **Validation**: Server-side in POST handlers (email regex, required fields)
- **Existing APIs**: `/api/contact`, `/api/tracking?caseId=X`, `/api/quote`

## Development Workflow

### Commands (pnpm preferred)
```bash
pnpm dev          # Dev server :3000 (auto-restart on file changes)
pnpm build        # Production build (check before deploy)
pnpm lint         # ESLint for Next.js + TypeScript
pnpm type-check   # TypeScript validation without building
```

### Path Aliases
- **`@/*`** maps to workspace root: `@/components/Header`, `@/app/globals.css`
- Never use relative paths from `app/` directory

### Hydration Handling
**Problem**: Client-side animations cause hydration mismatches.
**Solution**: [Hero.tsx](../components/Hero.tsx) pattern:
```tsx
const [isClient, setIsClient] = useState(false)
useEffect(() => setIsClient(true), [])
return <section>{isClient && <AnimatedElements />}</section>
```
Also use `suppressHydrationWarning` in [layout.tsx](../app/layout.tsx) for `<html>`/`<body>`.

## Component Patterns

### Section Template (all follow this):
```tsx
export default function SectionName() {
  return (
    <section id="section-id" className="section-padding bg-{light|white|gradient}">
      <div className="container-wide">
        {/* Centered title block */}
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4">Title</h2>
          <p className="text-xl text-gray-600">Subtitle</p>
        </div>
        {/* Grid/flex content */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Cards */}
        </div>
      </div>
    </section>
  )
}
```

### Data Co-location
**Always inline data within component**:
```tsx
const services = [
  { icon: '🦷', title: 'Crowns', description: '...' },
  // ...
]
```
- No external JSON files or data modules
- Icons are emoji characters (🦷🔧📐), not icon libraries
- See [Services.tsx](../components/Services.tsx), [Automation.tsx](../components/Automation.tsx) for examples

### Form Pattern ([ContactForm.tsx](../components/ContactForm.tsx))
```tsx
const [formData, setFormData] = useState({...})
const [loading, setLoading] = useState(false)
const [submitted, setSubmitted] = useState(false)

const handleSubmit = async (e) => {
  e.preventDefault()
  setLoading(true)
  const res = await fetch('/api/contact', { method: 'POST', body: JSON.stringify(formData) })
  if (res.ok) {
    setSubmitted(true)
    setTimeout(() => setSubmitted(false), 5000) // Auto-dismiss
  }
  setLoading(false)
}
```
- Validation: API-side (server), not client-side (except HTML5 `required`)
- No form libraries (react-hook-form, formik) - keep simple

## TypeScript Conventions
- **Interface definitions**: Co-located with API routes (e.g., `interface ContactRequest` in route.ts)
- **Import types**: Use `import type { ... }` for type-only imports
- **API types**: `NextRequest`, `NextResponse` from `next/server`
- **Strict mode**: Enabled in tsconfig.json

## Metadata & SEO
All in [app/layout.tsx](../app/layout.tsx): `title`, `description`, `keywords`, favicons. Single source of truth for site metadata.

## Assets
- **Favicons**: Generated from `/public/Gemini_Generated_Image_blueround.png` using ImageMagick
- **Logo**: `/public/logo.png` used in [components/Logo.tsx](../components/Logo.tsx) via Next.js `<Image>` with priority
- **Commands**: Regenerate favicons: `cd public && magick source.png -trim -resize 32x32 favicon.ico`

## What NOT to Do
- ❌ Add state management (Redux, Zustand) - forms are simple, no shared state needed
- ❌ Add database/auth to APIs - intentionally demo-only
- ❌ Create CSS modules or styled-components - Tailwind only
- ❌ Split components into subdirectories - flat `/components` structure
- ❌ Use `<Link>` for in-page navigation - use smooth scroll: `document.getElementById('section')?.scrollIntoView({ behavior: 'smooth' })`
- ❌ Install icon libraries - use emoji characters
- ❌ Add ESLint ignore for Tailwind `@apply` warnings in globals.css - expected behavior

## Key Files Reference
- [app/page.tsx](../app/page.tsx) - Page composition (imports all sections)
- [components/Hero.tsx](../components/Hero.tsx) - Client component with hydration pattern
- [components/ContactForm.tsx](../components/ContactForm.tsx) - Form handling pattern
- [components/Services.tsx](../components/Services.tsx) - Data co-location example
- [app/api/contact/route.ts](../app/api/contact/route.ts) - API route pattern
- [app/globals.css](../app/globals.css) - Custom Tailwind utilities
- [tailwind.config.ts](../tailwind.config.ts) - Theme colors and extensions
