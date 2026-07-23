'use client'

import { useLayoutEffect, useRef, useState, useEffect, type ReactNode } from 'react'

export interface SegOption<T extends string> {
  value: T
  label: string
  icon?: ReactNode
  title?: string
}

/**
 * Segmented control with a sliding "thumb" that animates to the selected
 * segment. The thumb is measured from the active button so segments can have
 * different widths and the pill still lands exactly on them.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  collapseLabels = false,
}: {
  options: SegOption<T>[]
  value: T
  onChange: (value: T) => void
  ariaLabel?: string
  /**
   * When true, options that have an icon show icon-only on phones and reveal
   * their text label from the `sm` breakpoint up. The label stays available to
   * screen readers at all sizes. Keeps long labels from wrapping on mobile.
   */
  collapseLabels?: boolean
}) {
  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const [thumb, setThumb] = useState<{ left: number; width: number } | null>(null)

  const measure = () => {
    const el = btnRefs.current[value]
    if (el) setThumb({ left: el.offsetLeft, width: el.offsetWidth })
  }

  // Position before paint so the pill starts in the right place.
  useLayoutEffect(measure, [value, options.length])

  useEffect(() => {
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="relative inline-flex items-center rounded-full bg-slate-100 p-0.5"
    >
      {thumb && (
        <span
          aria-hidden="true"
          className="absolute top-0.5 bottom-0.5 rounded-full bg-primary shadow-sm transition-all duration-300 ease-out motion-reduce:transition-none"
          style={{ left: thumb.left, width: thumb.width }}
        />
      )}
      {options.map(o => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            ref={el => {
              btnRefs.current[o.value] = el
            }}
            type="button"
            role="tab"
            aria-selected={active}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={`relative z-10 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
              active ? 'text-white font-semibold' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {o.icon}
            {collapseLabels && o.icon ? (
              <span className="sr-only sm:not-sr-only">{o.label}</span>
            ) : (
              o.label
            )}
          </button>
        )
      })}
    </div>
  )
}
