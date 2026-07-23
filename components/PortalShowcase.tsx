import Link from 'next/link'

type FeatureIcon = 'chat' | 'clock' | 'pipeline' | 'bell'

function FeatureGlyph({ name, className = 'w-5 h-5' }: { name: FeatureIcon; className?: string }) {
  const svg = (children: React.ReactNode) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  )
  switch (name) {
    case 'chat':
      return svg(<path d="M4 6h16a1.5 1.5 0 0 1 1.5 1.5v7A1.5 1.5 0 0 1 20 16h-8l-5 4v-4H4a1.5 1.5 0 0 1-1.5-1.5v-7A1.5 1.5 0 0 1 4 6z" />)
    case 'clock':
      return svg(<><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.5 2" /></>)
    case 'pipeline':
      return svg(<><circle cx="5" cy="12" r="2.2" /><circle cx="12" cy="12" r="2.2" /><circle cx="19" cy="12" r="2.2" /><path d="M7.2 12h2.6M14.2 12h2.6" /></>)
    case 'bell':
      return svg(<path d="M18 8a6 6 0 1 0-12 0c0 6-2.5 7-2.5 7h17S18 14 18 8zM10.5 20a2 2 0 0 0 3 0" />)
  }
}

export default function PortalShowcase() {
  const features: { icon: FeatureIcon; title: string; desc: string }[] = [
    { icon: 'chat', title: 'Real-time collaboration', desc: 'Message the lab directly on every case — no phone tag, no lost emails.' },
    { icon: 'clock', title: 'Deadline & SLA tracking', desc: 'See exactly when each case is due and whether it`s on track for the surgery date.' },
    { icon: 'pipeline', title: 'Full case lifecycle', desc: 'Follow every stage from received → design → manufacturing → QA → shipped.' },
    { icon: 'bell', title: 'Instant updates', desc: 'Unread badges and notifications the moment the lab replies or a status changes.' },
  ]

  return (
    <section id="portal" className="section-padding bg-white scroll-mt-20">
      <div className="container-wide">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Copy + features */}
          <div>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary bg-primary/10 rounded-full px-3 py-1 mb-4">
              Doctor Portal
            </span>
            <h2 className="text-4xl font-bold mb-4">Every case, in real time</h2>
            <p className="text-lg text-gray-600 mb-8 max-w-xl">
              A modern portal for the practices we partner with — submit cases, talk to your lab team,
              and always know exactly where your work stands and when it ships.
            </p>

            <ul className="space-y-5 mb-8">
              {features.map(f => (
                <li key={f.title} className="flex gap-4">
                  <span className="flex-shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-xl bg-secondary/10 text-secondary">
                    <FeatureGlyph name={f.icon} />
                  </span>
                  <div>
                    <h3 className="font-semibold text-gray-900">{f.title}</h3>
                    <p className="text-gray-600 text-sm">{f.desc}</p>
                  </div>
                </li>
              ))}
            </ul>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/portal/login" className="btn-primary text-center motion-safe:hover:scale-105 transition-transform">
                Doctor Login
              </Link>
              <Link
                href="/#contact"
                className="px-6 py-3 border-2 border-secondary text-secondary rounded-lg font-semibold text-center hover:bg-secondary hover:text-white transition-all motion-safe:hover:scale-105"
              >
                Become a Partner
              </Link>
            </div>
          </div>

          {/* Faux product mock */}
          <div className="relative">
            <div className="absolute -inset-4 bg-gradient-to-tr from-primary/10 via-secondary/10 to-accent/10 rounded-3xl blur-xl" aria-hidden="true" />
            <div className="relative rounded-2xl border border-gray-200 shadow-xl bg-white overflow-hidden">
              {/* browser chrome */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50">
                <span className="w-3 h-3 rounded-full bg-red-400" />
                <span className="w-3 h-3 rounded-full bg-amber-400" />
                <span className="w-3 h-3 rounded-full bg-green-400" />
                <span className="ml-3 flex-1 text-xs text-gray-400 bg-white border border-gray-200 rounded-md px-3 py-1 truncate">
                  portal.jdlab.us/cases
                </span>
              </div>

              {/* toolbar */}
              <div className="px-4 pt-4 pb-2 flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium text-slate-500">My Cases <span className="text-slate-400">· 3 of 12 · 9 active</span></span>
                <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-white bg-accent rounded-full px-2.5 py-1">
                  2 unread
                  <span className="relative flex w-1.5 h-1.5">
                    <span className="motion-safe:animate-ping absolute inline-flex h-full w-full rounded-full bg-white/70" />
                    <span className="relative inline-flex rounded-full w-1.5 h-1.5 bg-white" />
                  </span>
                </span>
              </div>

              {/* case rows */}
              <div className="px-4 pb-4 space-y-3">
                {[
                  { no: 'DL-0042', title: 'Crown #14', pill: 'Manufacturing', color: 'bg-violet-50 text-violet-700 ring-violet-200', due: 'Due in 2 days', unread: true },
                  { no: 'DL-0041', title: 'Implant guide #30', pill: 'Design', color: 'bg-blue-50 text-blue-700 ring-blue-200', due: 'On track', unread: false },
                  { no: 'DL-0039', title: 'Full arch — maxillary', pill: 'QA', color: 'bg-cyan-50 text-cyan-700 ring-cyan-200', due: 'Ships tomorrow', unread: false },
                ].map(c => (
                  <div key={c.no} className="relative rounded-xl border border-slate-200 pl-4 pr-3 py-3 shadow-sm">
                    <span className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl bg-secondary/60" aria-hidden="true" />
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-mono text-slate-400">{c.no}</span>
                      <span className="font-semibold text-slate-800 text-sm">{c.title}</span>
                      {c.unread && (
                        <span className="inline-flex items-center justify-center min-w-[1.1rem] h-4 px-1 rounded-full bg-accent text-white text-[10px] font-semibold">1</span>
                      )}
                      <span className={`ml-auto inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full ring-1 ring-inset ${c.color}`}>{c.pill}</span>
                    </div>
                    <div className="mt-1.5 text-xs text-slate-400">{c.due}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
