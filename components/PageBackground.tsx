export default function PageBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      {/* Base gradient background - bright and clean */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-cyan-50"></div>
      
      {/* Dental lab theme elements */}
      
      {/* 3D Printer visualization */}
      <div className="absolute top-32 left-10 w-64 h-64 opacity-5">
        <svg viewBox="0 0 200 200" className="w-full h-full text-primary">
          <rect x="40" y="60" width="120" height="100" stroke="currentColor" strokeWidth="2" fill="none"/>
          <circle cx="100" cy="100" r="20" stroke="currentColor" strokeWidth="2" fill="none"/>
          <rect x="50" y="50" width="100" height="15" stroke="currentColor" strokeWidth="2" fill="none"/>
        </svg>
      </div>

      {/* CAD/CAM design element */}
      <div className="absolute bottom-40 right-20 w-56 h-56 opacity-4">
        <svg viewBox="0 0 200 200" className="w-full h-full text-secondary">
          <circle cx="100" cy="100" r="60" stroke="currentColor" strokeWidth="2" fill="none"/>
          <circle cx="100" cy="100" r="40" stroke="currentColor" strokeWidth="2" fill="none"/>
          <line x1="100" y1="40" x2="100" y2="160" stroke="currentColor" strokeWidth="1"/>
          <line x1="40" y1="100" x2="160" y2="100" stroke="currentColor" strokeWidth="1"/>
        </svg>
      </div>

      {/* Tooth/Crown design */}
      <div className="absolute top-1/2 -left-20 w-48 h-48 opacity-3">
        <svg viewBox="0 0 200 200" className="w-full h-full text-accent">
          <path d="M 100 20 L 120 80 L 130 120 Q 100 150 70 120 L 80 80 Z" stroke="currentColor" strokeWidth="2" fill="none"/>
        </svg>
      </div>

      {/* Floating gradient orbs - dental lab colors */}
      <div className="absolute top-20 -left-40 w-80 h-80 bg-primary/8 rounded-full blur-3xl"></div>
      <div className="absolute top-40 -right-32 w-72 h-72 bg-secondary/8 rounded-full blur-3xl"></div>
      <div className="absolute -bottom-20 left-1/3 w-96 h-96 bg-accent/4 rounded-full blur-3xl"></div>
      <div className="absolute bottom-32 -right-48 w-80 h-80 bg-primary/6 rounded-full blur-3xl"></div>
      
      {/* Laboratory equipment pattern - very subtle */}
      <div className="absolute inset-0 opacity-[0.015]">
        <svg width="100%" height="100%" className="text-primary">
          <defs>
            <pattern id="lab-pattern" x="0" y="0" width="120" height="120" patternUnits="userSpaceOnUse">
              {/* Microscope element */}
              <circle cx="30" cy="30" r="8" stroke="currentColor" strokeWidth="0.5" fill="none"/>
              <line x1="30" y1="38" x2="30" y2="50" stroke="currentColor" strokeWidth="0.5"/>
              {/* Test tube */}
              <rect x="70" y="20" width="8" height="40" stroke="currentColor" strokeWidth="0.5" fill="none"/>
              <circle cx="74" cy="20" r="4" stroke="currentColor" strokeWidth="0.5" fill="none"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#lab-pattern)"/>
        </svg>
      </div>

      {/* Dental precision grid overlay */}
      <div className="absolute inset-0 opacity-[0.02] bg-[linear-gradient(0deg,transparent_24%,rgba(0,102,204,.08)_25%,rgba(0,102,204,.08)_26%,transparent_27%,transparent_74%,rgba(0,102,204,.08)_75%,rgba(0,102,204,.08)_76%,transparent_77%,transparent),linear-gradient(90deg,transparent_24%,rgba(0,102,204,.08)_25%,rgba(0,102,204,.08)_26%,transparent_27%,transparent_74%,rgba(0,102,204,.08)_75%,rgba(0,102,204,.08)_76%,transparent_77%,transparent)] bg-[length:80px_80px]"></div>
      
      {/* Light source from top for lab feel */}
      <div className="absolute inset-0 opacity-30" style={{backgroundImage: 'radial-gradient(circle at 50% -20%, rgba(0, 102, 204, 0.15), transparent 60%)'}}></div>

      {/* Subtle vignette effect */}
      <div className="absolute inset-0 opacity-10" style={{backgroundImage: 'radial-gradient(circle at 50% 50%, transparent 0%, rgba(0, 0, 0, 0.3) 100%)'}}></div>
    </div>
  )
}

