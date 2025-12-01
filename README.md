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

## 📁 Project Structure

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

## 📝 License

This project is part of the JD Dental Lab initiative.

## 🤝 Support

For questions or support, contact: info@jdlab.us

---

Built with ❤️ for dental professionals worldwide.
