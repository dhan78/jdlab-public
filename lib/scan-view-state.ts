/**
 * Per-scan camera view persistence (pan / zoom / orbit), so a doctor who sets up
 * an angle, leaves a case, and comes back — even after a full reload — gets the
 * SAME view instead of a reset-to-frame.
 *
 * Stored in localStorage (survives reloads) keyed by a caller-supplied stable
 * scan id. Only the camera position + orbit target are kept (that fully defines
 * a perspective orbit view); nothing about the scan itself is stored, so it's
 * PHI-safe. Best-effort: any storage error (private mode / quota) is swallowed.
 *
 * Browser-only module — safe to import from a 'use client' component.
 */
export interface ScanView {
  pos: [number, number, number] // camera world position
  target: [number, number, number] // orbit target
}

const PREFIX = 'jdlab-scanview:'

export function loadScanView(id: string): ScanView | null {
  if (typeof window === 'undefined' || !id) return null
  try {
    const raw = window.localStorage.getItem(PREFIX + id)
    if (!raw) return null
    const v = JSON.parse(raw) as Partial<ScanView>
    if (
      Array.isArray(v?.pos) && v.pos.length === 3 && v.pos.every(n => Number.isFinite(n)) &&
      Array.isArray(v?.target) && v.target.length === 3 && v.target.every(n => Number.isFinite(n))
    ) {
      return { pos: v.pos as [number, number, number], target: v.target as [number, number, number] }
    }
    return null
  } catch {
    return null
  }
}

export function saveScanView(id: string, view: ScanView): void {
  if (typeof window === 'undefined' || !id) return
  try {
    window.localStorage.setItem(PREFIX + id, JSON.stringify(view))
  } catch {
    /* private mode / quota — best-effort */
  }
}

export function clearScanView(id: string): void {
  if (typeof window === 'undefined' || !id) return
  try {
    window.localStorage.removeItem(PREFIX + id)
  } catch {
    /* ignore */
  }
}
