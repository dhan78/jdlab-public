// Shared "sleepy puppy" mascot used by the 404 / not-found states (demo sample
// case + portal case-not-found). Inline SVG = no external image request. The
// gentle motion (breathing, an occasional ear twitch, floating "zzz") reads as
// "napping, not broken" — and every animation is gated behind
// `prefers-reduced-motion: no-preference`, so motion-sensitive users get a
// calm, static illustration.
export default function SleepyPuppy({ className }: { className?: string }) {
  return (
    <svg
      role="img"
      aria-label="A friendly sleeping puppy"
      viewBox="0 0 200 200"
      className={className}
    >
      <ellipse cx="100" cy="178" rx="60" ry="8" fill="#0f172a" opacity="0.06" />
      {/* ears (each twitches occasionally) */}
      <path className="puppy-ear-l" d="M52 70 C30 60 26 108 46 126 C60 112 62 86 66 78 Z" fill="#b98a5e" />
      <path className="puppy-ear-r" d="M148 70 C170 60 174 108 154 126 C140 112 138 86 134 78 Z" fill="#b98a5e" />
      {/* head + face gently "breathe" together */}
      <g className="puppy-breathe">
        {/* head */}
        <ellipse cx="100" cy="104" rx="58" ry="52" fill="#d9b287" />
        {/* muzzle */}
        <ellipse cx="100" cy="124" rx="34" ry="28" fill="#f0dcc2" />
        {/* closed, content eyes */}
        <path d="M74 104 q9 9 18 0" fill="none" stroke="#3f2d1c" strokeWidth="4" strokeLinecap="round" />
        <path d="M108 104 q9 9 18 0" fill="none" stroke="#3f2d1c" strokeWidth="4" strokeLinecap="round" />
        {/* blush */}
        <circle cx="66" cy="120" r="7" fill="#ff6b35" opacity="0.18" />
        <circle cx="134" cy="120" r="7" fill="#ff6b35" opacity="0.18" />
        {/* nose + mouth */}
        <path d="M100 116 c-8 0 -12 7 -6 11 l6 4 6 -4 c6 -4 2 -11 -6 -11 Z" fill="#3f2d1c" />
        <path d="M100 131 v6 M100 137 q-8 6 -15 2 M100 137 q8 6 15 2" fill="none" stroke="#3f2d1c" strokeWidth="3" strokeLinecap="round" />
      </g>
      {/* little "zzz" floats up to read as napping, not broken */}
      <text className="puppy-z puppy-z1" x="150" y="60" fontFamily="ui-sans-serif, system-ui" fontSize="16" fontWeight="700" fill="#0066cc" opacity="0.7">z</text>
      <text className="puppy-z puppy-z2" x="162" y="48" fontFamily="ui-sans-serif, system-ui" fontSize="12" fontWeight="700" fill="#0066cc" opacity="0.55">z</text>
    </svg>
  )
}
