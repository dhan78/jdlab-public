# JD Dental Lab Website - AI Agent Instructions

## Project Overview
Next.js 15 dental lab marketing website with TypeScript, Tailwind CSS, and API routes. Company: JD Dental Lab. Contact: info@jdlab.us, 551-226-9540.

## Architecture

### Component Structure
- **Server Components (default)**: All components in `app/` unless using hooks/events
- **Client Components (`'use client'`)**: Required for interactivity - forms, animations, event handlers
  - Example: `Hero.tsx` uses client-side for scroll functionality and hydration-safe animations
  - Example: `ContactForm.tsx` uses client-side for form state management

### Hydration Safety Pattern
**Critical**: Prevent SSR/client mismatches when using animations or browser-dependent features:
```tsx
'use client'
const [isClient, setIsClient] = useState(false)
useEffect(() => setIsClient(true), [])
// Render animations only when {isClient && <animated-elements>}
```
Always add `suppressHydrationWarning` to `<html>` and `<body>` in `layout.tsx` to handle browser extensions.

### Custom Styling System
**Color Palette** (in `tailwind.config.ts`):
- `primary`: #0066cc (blue) - main brand color
- `secondary`: #00a699 (teal) - accents
- `accent`: #ff6b35 (orange) - highlights
- `dark`: #1a1a1a, `light`: #f5f5f5

**Reusable Classes** (in `app/globals.css` @layer components):
- `.btn-primary` / `.btn-secondary` - styled buttons with hover states
- `.section-padding` - consistent py-16 px-4 spacing
- `.container-wide` - max-w-7xl mx-auto wrapper

**Pattern**: Always use Tailwind utilities first, only create custom classes for repeated multi-utility patterns.

## Key Sections & IDs

Navigation anchors for smooth scrolling:
- `#services` - Services.tsx
- `#automation` - Automation.tsx  
- `#global` - GlobalReach.tsx
- `#contact` - ContactForm.tsx

Scroll implementation: `document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })`

## API Routes Pattern

Located in `app/api/[endpoint]/route.ts`. All use in-memory storage (demo only - flag for production DB migration):

```typescript
// POST handler signature
export async function POST(request: NextRequest) {
  const body = await request.json()
  // Validation, processing
  return NextResponse.json({ success: true }, { status: 201 })
}

// GET handler signature  
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  // Process query params
  return NextResponse.json({ data })
}
```

**Existing APIs**:
- `/api/contact` - Contact form submissions (name, email, phone, service, message)
- `/api/tracking` - Case tracking (caseId query param)
- `/api/quote` - Quote generation (service, quantity, material, rush)

## Development Workflow

```bash
# Install (always use npm, not pnpm despite README)
npm install

# Dev server (runs on port 3000)
npm run dev

# Production build
npm run build
npm start

# Type checking only
npm run type-check
```

## Component Conventions

### File Structure
- **Top-level components**: Export default function matching filename
- **Sections**: Use `<section id="slug" className="section-padding">` wrapper
- **Responsive**: Always include sm:, md:, lg: breakpoints for layouts

### Form Components
Pattern from `ContactForm.tsx`:
1. Use controlled components with local state
2. Generic `handleChange` for all inputs: `const { name, value } = e.target`
3. Loading states during async operations
4. Success/error feedback with auto-dismiss timeout
5. Clear form on success: `setFormData({ ...initialState })`

### Background Components
- Fixed positioning: `fixed inset-0 -z-10` 
- Dental lab theme: subtle SVG illustrations (3D printers, CAD/CAM, teeth) at 3-5% opacity
- Gradient orbs: `blur-3xl` with primary/secondary colors at low opacity
- Tech grid: `bg-[length:80px_80px]` pattern overlay at 2% opacity

## Branding Guidelines

**Critical**: Company name is "JD Dental Lab" (never "Digital Dental Lab")
- Logo: "JD" letters in gradient box
- Tagline: "Global Innovation"
- No use of "Laboratory" - always use "Lab"

## Production TODOs
Current demo limitations requiring upgrade:
1. In-memory API storage → database (PostgreSQL/MongoDB)
2. No email notifications → SendGrid/AWS SES integration
3. No authentication/rate limiting on APIs
4. Contact info hardcoded → environment variables
5. No analytics integration

## Common Modifications

**Update contact info**: `components/ContactForm.tsx` + `components/Footer.tsx` + `README.md`

**Add new service**: Update `components/Services.tsx` services array with icon, title, description

**Change colors**: Modify `tailwind.config.ts` theme.extend.colors, update button hover states in `globals.css`

**Add API endpoint**: Create `app/api/[name]/route.ts`, follow NextRequest/NextResponse pattern

## TypeScript Patterns
- Interface types for API request/response bodies
- React.FormEvent for form handlers
- React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement> for input handlers
- Explicit return types for API handlers: `Promise<NextResponse>`

## Performance Notes
- Server components by default = faster initial load
- Animations hydrated client-side only to prevent SSR mismatch
- Fixed background layers prevent repaints during scroll
- Lazy gradient orbs load after hydration in Hero component
