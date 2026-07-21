# JD Dental Lab Website

A modern, responsive website for JD Dental Lab, a digital dental and medical devices lab featuring global reach and process automation.

## 🚀 Features

### Frontend
- **Modern Design**: Built with Next.js App Router and Tailwind CSS
- **Responsive**: Fully mobile-responsive with optimal viewing on all devices
- **Performance**: Server components for optimal performance
- **TypeScript**: Full type safety throughout the application

### Key Sections

#### Hero Section
- Compelling headline highlighting global innovation
- Call-to-action buttons for service exploration and demos

#### Services
- 6 core services: Crowns & Bridges, Implants, CAD/CAM, 3D Printing, Dentures, Medical Devices
- Card-based layout with icons and descriptions
- Easy navigation and visual hierarchy

#### Workflow Automation
- 6-step automated process visualization
- Shows efficiency gains (24-48 hour turnaround)
- Quality assurance metrics (99.8% accuracy)

#### Global Reach
- 4 major geographic regions with partnership counts
- Strategic facilities across continents
- Real statistics on served countries and completed cases
- Worldwide same-day delivery network highlights

#### Contact & Lead Generation
- Professional contact form with form validation
- Service selection dropdown
- Backend API integration
- Success notifications

### Backend APIs

#### Contact Form API (`/api/contact`)
- Accepts inquiries from potential customers
- Validates input data
- Returns confirmation with request ID
- GET endpoint to retrieve all contact requests (demo)

#### Case Tracking API (`/api/tracking`)
- Track cases through the workflow pipeline
- Real-time progress updates
- Estimated delivery dates
- Status stages: received, designing, manufacturing, qa, shipped, delivered

#### Quote Generation API (`/api/quote`)
- Generate instant quotes for services
- Pricing based on service, quantity, material, and rush options
- 30-day quote validity
- Turnaround time estimates

## 🛠️ Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS with custom components
- **Backend**: Node.js with Next.js API Routes
- **Build Tool**: Next.js built-in bundler
- **Package Manager**: pnpm (recommended)

## 📦 Installation & Setup

### Prerequisites
- Node.js 18+ or compatible runtime
- pnpm (recommended) or npm

### Installation

```bash
# Install dependencies
pnpm install
# or
npm install
```

### Development

```bash
# Start development server
pnpm dev
# or
npm run dev
```

Visit `http://localhost:3000` in your browser.

### Production Build

```bash
# Build for production
pnpm build

# Start production server
pnpm start
```

## � Development Workflow

The standard loop for adding a feature or fixing a bug. Use **npm** on the JPMC machine (see the Outline note about the proxy).

### 1. Make the change
Edit code under `app/`, `components/`, `lib/`, etc.

### 2. If you changed the database schema (`lib/db/schema.ts`)
```bash
npm run db:generate    # creates a new migration in drizzle/ from the schema diff
npm run db:migrate     # applies pending migrations to your local Postgres
```
Commit **both** the schema change **and** the generated `drizzle/*.sql` + `drizzle/meta/*` files — the migration is how other machines get the change.

### 3. Validate
```bash
npm run type-check     # tsc --noEmit
npm run lint           # optional
npm run test           # optional (vitest)
```

### 4. Commit & push (Bitbucket)
`develop`/`master`/`main` are **protected** — you cannot push to them directly. Push a feature branch and open a PR.
```bash
git add -A
git commit -m "Short summary" -m "Optional detail about why."
# push local branch to a NON-protected remote branch:
git push origin HEAD:feature/<your-branch>
```
Then open the PR from the link Bitbucket prints, targeting `develop`.

> Commits must use your corporate identity (a `CommitterIdentityHook` enforces it):
> ```bash
> git config user.name  "v032823"
> git config user.email "v032823@jpmcfid.jpmorgan.com"
> ```

### 5. Mirror the source to Outline (optional)
```powershell
$env:NODE_USE_ENV_PROXY='1'; npm run outline:publish
```

### 6. Pull the change on another machine
```bash
git pull
npm install            # if dependencies changed
npm run db:migrate     # apply any new migrations (idempotent)
npm run dev
```

## �📁 Project Structure

```
├── app/
│   ├── api/
│   │   ├── contact/        # Contact form endpoint
│   │   ├── tracking/       # Case tracking endpoint
│   │   └── quote/          # Quote generation endpoint
│   ├── page.tsx            # Home page
│   ├── layout.tsx          # Root layout
│   └── globals.css         # Global styles
├── components/
│   ├── Header.tsx          # Navigation header
│   ├── Hero.tsx            # Hero section
│   ├── Services.tsx        # Services showcase
│   ├── Automation.tsx      # Workflow automation section
│   ├── GlobalReach.tsx     # Global reach section
│   ├── ContactForm.tsx     # Contact form
│   └── Footer.tsx          # Footer
├── tailwind.config.ts      # Tailwind configuration
├── tsconfig.json           # TypeScript configuration
├── next.config.ts          # Next.js configuration
└── package.json            # Dependencies and scripts
```

## 🎨 Customization

### Colors
Modify the color scheme in `tailwind.config.ts`:
```typescript
colors: {
  primary: '#0066cc',      // Primary blue
  secondary: '#00a699',    // Teal secondary
  accent: '#ff6b35',       // Orange accent
}
```

### Services
Edit `components/Services.tsx` to add/modify services

### Global Regions
Update `components/GlobalReach.tsx` with your actual facilities and partnerships

### Contact Information
Update footer contact details in `components/Footer.tsx`

## 🔒 Production Considerations

### Before Deploying
1. **Database Integration**: Replace in-memory storage with a proper database (PostgreSQL, MongoDB, etc.)
2. **Email Notifications**: Integrate email service (SendGrid, AWS SES, etc.)
3. **Authentication**: Add API authentication and rate limiting
4. **Error Handling**: Implement comprehensive error logging
5. **SEO**: Add meta tags and structured data
6. **Analytics**: Integrate analytics (Google Analytics, etc.)
7. **CRM Integration**: Connect to CRM system for lead management

### Environment Variables
Create `.env.local`:
```
NEXT_PUBLIC_API_URL=https://your-domain.com
DATABASE_URL=your_database_url
EMAIL_SERVICE_KEY=your_email_service_key
```

## 🚀 Deployment

### Vercel (Recommended)
```bash
pnpm install -g vercel
vercel
```

### Other Platforms
- AWS Amplify
- Netlify
- Docker container
- Self-hosted Node.js server

## 📊 Performance Features

- Server-side rendering for better SEO
- Optimized images and lazy loading
- CSS modules and Tailwind CSS for minimal bundle
- API routes for backend functionality
- Progressive enhancement

## 🔄 API Examples

### Create Contact
```bash
curl -X POST http://localhost:3000/api/contact \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Dr. Smith",
    "email": "doctor@clinic.com",
    "service": "crowns",
    "message": "Interested in your crown services"
  }'
```

### Track Case
```bash
curl http://localhost:3000/api/tracking?caseId=CASE-12345
```

### Get Quote
```bash
curl -X POST http://localhost:3000/api/quote \
  -H "Content-Type: application/json" \
  -d '{
    "service": "crowns",
    "quantity": 10,
    "material": "zirconia",
    "rush": false
  }'
```

## � Outline Wiki Sync

Two scripts sync the repository's source files to (and from) an [Outline](https://www.getoutline.com/) wiki, preserving the folder structure so it can be reproduced on another machine.

- `scripts/publish-to-outline.ts` — walks folders and writes a **parent index document** (a directory tree) plus **one child document per top-level folder** (`app`, `components`, `lib`, …), each containing one section per file. Idempotent: re-running replaces the bodies.
- `scripts/import-from-outline.ts` — reads the parent + all child documents and recreates every file at its original path.

> **Why child documents?** This Outline instance rejects a single document larger than ~560 KB (gateway `502`). The full repo is ~880 KB of text, so it's split per top-level folder; each child stays under the limit. Bodies are also chunked (~40 KB per API request) with retry/backoff on `502`.

### Configuration (`.env.local`)

```bash
OUTLINE_URL=https://docs.jdlab.us/api      # self-hosted; omit for getoutline.com cloud
OUTLINE_TOKEN=ol_api_xxxxxxxxxxxxxxxx       # Outline → Settings → API Tokens
OUTLINE_DOCUMENT_ID=ZereHWBBc7             # parent doc urlId from /doc/<slug>-<urlId> (or use OUTLINE_DOCUMENT_URL)
```

### Publish (repo → Outline)

```powershell
# all default targets (app, components, lib, drizzle, scripts, tests, specs, deploy, test-fixtures + root config)
npm run outline:publish

# selective: pass paths after `--` (overrides defaults; folders walked recursively)
npm run outline:publish -- app/api lib/db docker-compose.yml README.md
```

### Import (Outline → files, reproduce on another machine)

```powershell
npm run outline:import                    # writes to ./outline-export
npm run outline:import -- --out ../restored
npm run outline:import -- --dry-run       # preview, no writes
```

Ignored automatically: `node_modules`, `.next`, `.git`, `dist`, `public`, lockfiles, binary/font/media files, files > 256 KB, and **all secrets** (`.env*` are never synced). Text fixtures under `test-fixtures/` (SVG + ASCII STL) and the `deploy/` tree **are** synced so seeding and deployment can be reproduced. Because binaries (incl. `public/`) are excluded, copy `public/` and recreate `.env.local` separately when replicating.

### ⚠️ Corporate proxy note (required on JPMC machines)

`docs.jdlab.us` resolves to a Tailscale-range (`100.x`) address reachable **only via the corporate proxy** (`alpacaproxy`, `http://localhost:9443`). Node's `fetch` ignores `HTTP_PROXY`/`HTTPS_PROXY` by default, so a direct run fails with `fetch failed` (`UND_ERR_CONNECT_TIMEOUT`).

Set `NODE_USE_ENV_PROXY=1` **before** running (it's read at Node startup — setting it inside the script is too late):

```powershell
$env:NODE_USE_ENV_PROXY='1'; npm run outline:publish -- app/api lib/db
```

Add `$env:NODE_USE_ENV_PROXY = '1'` to your PowerShell `$PROFILE` to make it permanent. The proxy tunnels HTTPS via `CONNECT` (no TLS interception), so no extra CA certificate is needed.

## 📝 License

This project is part of the JD Dental Lab initiative.

## 🤝 Support

For questions or support, contact: info@jdlab.us

---

Built with ❤️ for dental professionals worldwide.
