// Inline SVG icons for case statuses (no icon library — project convention).
// Shared by the lifecycle tracker, sidebar, and case-thread chip so the glyph
// for each stage stays consistent everywhere.
import type { CaseStatus } from '@/lib/case-meta'

export function StatusIcon({
  status,
  className = 'w-4 h-4',
}: {
  status: CaseStatus
  className?: string
}) {
  const common = {
    className,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }
  switch (status) {
    case 'received': // tray with down arrow — a case has arrived
      return (
        <svg {...common}>
          <path d="M12 3v8m0 0 3-3m-3 3-3-3" />
          <path d="M4 14v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
        </svg>
      )
    case 'planning': // crosshair — planning implant positions
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="7" />
          <circle cx="12" cy="12" r="2.5" />
          <path d="M12 2.5V5M12 19v2.5M2.5 12H5M19 12h2.5" />
        </svg>
      )
    case 'design': // person at a computer — a technician designing on-screen
      return (
        <svg {...common}>
          <circle cx="7" cy="6" r="2.5" />
          <path d="M3 13.5a4 4 0 0 1 8 0" />
          <rect x="13.5" y="5" width="7.5" height="6" rx="1" />
          <path d="M17.25 11v2M15 15h4.5" />
        </svg>
      )
    case 'review': // person + bold check — doctor review/approval
      return (
        <svg {...common}>
          <circle cx="8" cy="6" r="2.6" />
          <path d="M2.8 18a5.2 5.2 0 0 1 10.2-1.4" />
          <path d="M13 14.5 15.8 17.5 21 11" strokeWidth={2.6} />
        </svg>
      )
    case 'production': // printer — printing/milling the appliance
      return (
        <svg {...common}>
          <path d="M7 9V4h10v5" />
          <rect x="5" y="9" width="14" height="7" rx="1.5" />
          <path d="M7 15h10v5H7z" />
        </svg>
      )
    case 'tryin': // tooth — wax try-in fitted at the clinic
      return (
        <svg {...common}>
          <path d="M7.5 3.5C5.6 3.5 4.5 5 4.5 7.2c0 2.6.8 5.2 1.8 7.6.5 1.2 1 2.4 1.4 3.2.5 1 1.9.9 2.2-.2l1-3.6c.2-.7 1-.7 1.2 0l1 3.6c.3 1.1 1.7 1.2 2.2.2.4-.8.9-2 1.4-3.2 1-2.4 1.8-5 1.8-7.6 0-2.2-1.1-3.7-3-3.7-1.4 0-2.1 1-3 1s-1.6-1-3-1z" />
        </svg>
      )
    case 'finishing': // sparkle — polished & finished
      return (
        <svg {...common}>
          <path d="M11 3.5l1.6 3.9 3.9 1.6-3.9 1.6L11 14.5 9.4 10.6 5.5 9l3.9-1.6z" />
          <path d="M18 14l.9 2.1 2.1.9-2.1.9L18 20l-.9-2.1-2.1-.9 2.1-.9z" />
        </svg>
      )
    case 'shipped': // truck — packaged & dispatched
      return (
        <svg {...common}>
          <path d="M3 6h11v9H3z" />
          <path d="M14 9h4l3 3v3h-7z" />
          <circle cx="7.5" cy="17.5" r="1.6" />
          <circle cx="16.5" cy="17.5" r="1.6" />
        </svg>
      )
  }
}
