// Image "collections" = purpose-scoped subfolders under public/images.
// A collection with `managed: true` is rendered as an auto-updating list on the
// site (e.g. the hero carousel reads its folder), so uploading/deleting a file
// changes the page with no code edit. `general` (root folder) holds one-off
// editorial images that are wired into a specific page by hand.

export interface ImageCollection {
  key: string
  label: string
  /** Subfolder under public/images ('' = the root folder itself). */
  dir: string
  /** True when the site renders this folder as a list (carousel, gallery…). */
  managed: boolean
}

export const IMAGE_COLLECTIONS: ImageCollection[] = [
  { key: 'hero', label: 'Hero carousel', dir: 'hero', managed: true },
  { key: 'general', label: 'General (page images)', dir: '', managed: false },
]

export function collectionByKey(key: string): ImageCollection | undefined {
  return IMAGE_COLLECTIONS.find(c => c.key === key)
}

export const IMAGE_EXT = new Set(['webp', 'jpg', 'jpeg', 'png'])

export function extOf(name: string): string {
  return name.split('.').pop()?.toLowerCase() ?? ''
}

// Public URL path for a file in a collection.
export function publicPath(collection: ImageCollection, name: string): string {
  return collection.dir ? `/images/${collection.dir}/${name}` : `/images/${name}`
}

// Human-readable caption from a filename: strip extension + leading "hero-",
// turn separators into spaces, sentence-case. e.g. hero-robot-lab.jpg -> "Robot lab".
export function deriveAlt(name: string): string {
  const stem = name.replace(/\.[^.]+$/, '').replace(/^hero-/, '')
  const words = stem.replace(/[-_]+/g, ' ').trim()
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : name
}
