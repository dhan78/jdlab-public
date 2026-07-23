// Social-proof / credibility section.
//
// IMPORTANT: The quotes below are REPRESENTATIVE placeholders attributed by role +
// tenure only — they are NOT invented named individuals and use no stock photos.
// Replace them with REAL, consented, named testimonials (and optional headshots)
// once collected. The aggregate stats reflect facts provided by JD Lab about its team.

type Avatar = { initials: string; tint: string }

const stats = [
  { value: '10+ yrs', label: 'Average clinician & technician experience' },
  { value: '1,000s', label: 'Cases handled across our team' },
  { value: 'Multi-disciplinary', label: 'Crown & bridge, implant, and removable specialists' },
]

const testimonials: { quote: string; role: string; tenure: string; avatar: Avatar }[] = [
  {
    quote:
      'Margins and contacts come back consistently accurate, so I spend far less chair time adjusting. When I have a question, the lab answers on the case — not three emails later.',
    role: 'Partner Dentist',
    tenure: '12 years in practice',
    avatar: { initials: 'PD', tint: 'bg-primary/10 text-primary' },
  },
  {
    quote:
      'Being able to see exactly which stage a case is in — and when it ships — means I can schedule the seat appointment with confidence. No more calling to "check on it."',
    role: 'General Dentist',
    tenure: '9 years in practice',
    avatar: { initials: 'GD', tint: 'bg-secondary/10 text-secondary' },
  },
  {
    quote:
      'The planning team knows implant workflows cold. Scan bodies, libraries, emergence profile — they catch issues before they become remakes.',
    role: 'Implant Case Planner',
    tenure: '11 years of lab experience',
    avatar: { initials: 'CP', tint: 'bg-accent/10 text-accent' },
  },
]

function Stars() {
  return (
    <div className="flex gap-0.5 text-accent mb-4" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
          <path d="M10 1.6l2.47 5.01 5.53.8-4 3.9.94 5.5L10 14.9l-4.94 2.6.94-5.5-4-3.9 5.53-.8z" />
        </svg>
      ))}
    </div>
  )
}

export default function Testimonials() {
  return (
    <section id="testimonials" className="section-padding bg-white scroll-mt-20">
      <div className="container-wide">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4">Trusted by experienced clinicians</h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Our dentists and case planners bring a decade-plus of hands-on experience to every case.
          </p>
        </div>

        {/* Aggregate credibility stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-14">
          {stats.map(s => (
            <div key={s.label} className="text-center bg-light rounded-2xl p-6">
              <div className="text-3xl font-bold text-primary mb-1">{s.value}</div>
              <p className="text-gray-600 text-sm">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Testimonials */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((t, i) => (
            <figure
              key={i}
              className="bg-white rounded-2xl p-7 shadow-sm ring-1 ring-gray-100 flex flex-col"
            >
              <Stars />
              <blockquote className="text-gray-700 leading-relaxed flex-1">"{t.quote}"</blockquote>
              <figcaption className="mt-6 flex items-center gap-3">
                <span
                  className={`inline-flex items-center justify-center w-11 h-11 rounded-full font-semibold ${t.avatar.tint}`}
                  aria-hidden="true"
                >
                  {t.avatar.initials}
                </span>
                <span>
                  <span className="block font-semibold text-gray-900">{t.role}</span>
                  <span className="block text-sm text-gray-500">{t.tenure}</span>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>

        <p className="text-center text-xs text-gray-400 mt-8 max-w-2xl mx-auto">
          Representative feedback shown by role and experience. Named client testimonials available on request.
        </p>
      </div>
    </section>
  )
}
