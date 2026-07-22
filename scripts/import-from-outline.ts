/**
 * Recreate repo files from the Outline document produced by publish-to-outline.
 * Parses each "## `relative/path`" section (fenced code or raw markdown) and
 * writes the file to its path under an output directory — so the folder
 * structure is reproduced on a different machine.
 *
 * Env (put OUTLINE_* in .env.local):
 *   OUTLINE_URL          API base. Yours: https://docs.jdlab.us/api
 *   OUTLINE_TOKEN        API token  [required]
 *   OUTLINE_DOCUMENT_ID  urlId (…/doc/jdlab-ZereHWBBc7 → ZereHWBBc7) or UUID.
 *   OUTLINE_DOCUMENT_URL Alternatively the full doc URL.
 *
 * Usage:
 *   npm run outline:import                 # writes to ./outline-export
 *   npm run outline:import -- --out ../restored
 *   npm run outline:import -- --dry-run    # list files without writing
 *   npm run outline:import -- --out . --prune   # reproduce in place AND delete
 *                                          # STALE files (ghosts) under reproduced
 *                                          # folders. Add --dry-run to preview the
 *                                          # deletions. Only removes files the
 *                                          # publisher would track — never binaries,
 *                                          # .env*, lockfiles, or files > 256 KB.
 */
import { mkdir, writeFile, readdir, stat, rm, rmdir } from 'node:fs/promises'
import { dirname, join, resolve, relative, isAbsolute, extname, sep } from 'node:path'

const API = (process.env.OUTLINE_URL ?? 'https://app.getoutline.com/api').replace(/\/+$/, '')
const TOKEN = process.env.OUTLINE_TOKEN

if (!TOKEN) {
  console.error('ERROR: OUTLINE_TOKEN is required.')
  process.exit(1)
}

function arg(name: string, fallback = ''): string {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}
const DRY = process.argv.includes('--dry-run')
const PRUNE = process.argv.includes('--prune')
const OUT = arg('out', 'outline-export')

// Prune scoping (mirrors publish-to-outline's ignore rules) so --prune only ever
// deletes STALE SOURCE files the publisher would have tracked — never binaries,
// secrets, lockfiles, or oversized files it intentionally skips.
const PRUNE_SKIP_DIRS = new Set([
  'node_modules', '.git', '.next', 'dist', 'build', 'out', 'coverage',
  '.turbo', '.vercel',
])
const PRUNE_SKIP_FILES = new Set([
  'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'next-env.d.ts',
])
const PRUNE_SKIP_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.woff', '.woff2',
  '.ttf', '.otf', '.pdf', '.zip', '.gz', '.mp4', '.mov', '.lock',
])
const PRUNE_MAX_BYTES = 256 * 1024

function resolveDocId(): string {
  const raw = process.env.OUTLINE_DOCUMENT_URL ?? process.env.OUTLINE_DOCUMENT_ID
  if (!raw) {
    console.error('ERROR: set OUTLINE_DOCUMENT_ID or OUTLINE_DOCUMENT_URL.')
    process.exit(1)
  }
  if (raw.includes('/doc/')) {
    const slug = raw.split('/doc/')[1].split(/[?#]/)[0]
    return slug.split('-').pop() as string
  }
  return raw
}

async function api<T = unknown>(method: string, body: unknown): Promise<T> {
  const res = await fetch(`${API}/${method}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`${method} → ${res.status} ${res.statusText} ${detail}`)
  }
  return res.json() as Promise<T>
}

// Pull file contents out of a section body: unwrap a fenced code block (of any
// backtick length, matched open-to-close), else treat the body as raw markdown
// (backward-compatible with the old inlined-markdown format).
function extractContent(body: string): string {
  const b = body.replace(/\r/g, '').replace(/\n---\s*$/, '').replace(/^\s+|\s+$/g, '')
  const fence = b.match(/^(`{3,})[^\n]*\n([\s\S]*?)\n\1$/)
  if (fence) return fence[2]
  return b
}

// Guard against path traversal from a malicious/edited doc. Resolve both to
// absolute paths and ensure the target stays inside outDir — this also allows
// writing in place with `--out .` (import over an existing checkout).
function safeJoin(outDir: string, rel: string): string | null {
  const baseAbs = resolve(outDir)
  const targetAbs = resolve(baseAbs, rel)
  const r = relative(baseAbs, targetAbs)
  return r && !r.startsWith('..') && !isAbsolute(r) ? targetAbs : null
}

// Parse "## `path`" sections from a document body and write each file.
async function writeSections(text: string, written: Set<string>): Promise<number> {
  const region = (() => {
    const i = text.indexOf('\n# Files')
    return i >= 0 ? text.slice(i) : text
  })()

  // Locate every file header, then take content as everything up to the NEXT
  // header (or end). Splitting by header position is robust to `#`/`$` inside
  // file bodies (Dockerfile comments, Markdown headings) that a single-regex
  // terminator would wrongly cut on — which left root files empty.
  const headerRe = /^## `([^`]+)`[ \t]*\r?\n/gm
  const heads: { path: string; contentStart: number; headerStart: number }[] = []
  let h: RegExpExecArray | null
  while ((h = headerRe.exec(region)) !== null) {
    heads.push({ path: h[1].trim(), headerStart: h.index, contentStart: h.index + h[0].length })
  }

  let count = 0
  for (let i = 0; i < heads.length; i++) {
    const rel = heads[i].path
    const end = i + 1 < heads.length ? heads[i + 1].headerStart : region.length
    const content = extractContent(region.slice(heads[i].contentStart, end))
    const target = safeJoin(OUT, rel)
    if (!target) {
      console.error(`skip (unsafe path): ${rel}`)
      continue
    }
    count++
    written.add(rel)
    if (DRY) {
      console.log(`would write: ${join(OUT, rel)}  (${content.length} bytes)`)
      continue
    }
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, content.endsWith('\n') ? content : content + '\n', 'utf8')
    console.log(`wrote: ${join(OUT, rel)}`)
  }
  return count
}

// True when a file would be IGNORED by the publisher — such files are never
// candidates for pruning (they legitimately live on disk but aren't in the doc).
function isPublisherIgnored(name: string, sizeBytes: number): boolean {
  if (PRUNE_SKIP_FILES.has(name)) return true
  if (PRUNE_SKIP_EXT.has(extname(name).toLowerCase())) return true
  if (name === '.env' || name.startsWith('.env.')) return true
  if (sizeBytes > PRUNE_MAX_BYTES) return true
  return false
}

// Recursively collect publishable file paths (relative to baseAbs, forward-slash)
// under dirAbs — skipping ignored dirs and files the publisher wouldn't track.
async function collectPrunable(baseAbs: string, dirAbs: string, acc: string[]): Promise<void> {
  let entries: string[]
  try {
    entries = await readdir(dirAbs)
  } catch {
    return
  }
  for (const name of entries) {
    if (PRUNE_SKIP_DIRS.has(name)) continue
    const abs = join(dirAbs, name)
    const s = await stat(abs)
    if (s.isDirectory()) {
      await collectPrunable(baseAbs, abs, acc)
    } else if (!isPublisherIgnored(name, s.size)) {
      acc.push(relative(baseAbs, abs).split(sep).join('/'))
    }
  }
}

// Recursively remove directories that are (or become) empty under dirAbs.
async function removeEmptyDirs(baseAbs: string, dirAbs: string): Promise<void> {
  let entries: string[]
  try {
    entries = await readdir(dirAbs)
  } catch {
    return
  }
  for (const name of entries) {
    const abs = join(dirAbs, name)
    if ((await stat(abs)).isDirectory()) await removeEmptyDirs(baseAbs, abs)
  }
  if ((await readdir(dirAbs)).length === 0) {
    await rmdir(dirAbs)
    console.log(`pruned empty dir: ${relative(baseAbs, dirAbs).split(sep).join('/')}`)
  }
}

// Delete stale files under the top-level FOLDERS reproduced this run. Scoped to
// those folders only (root-level files have no '/', so the output root itself is
// never scanned — node_modules, .env*, top-level junk are safe). Opt-in --prune.
async function pruneStale(written: Set<string>): Promise<void> {
  const baseAbs = resolve(OUT)

  const roots = new Set<string>()
  for (const rel of written) {
    const i = rel.indexOf('/')
    if (i > 0) roots.add(rel.slice(0, i))
  }
  if (roots.size === 0) {
    console.log('prune: no reproduced folders to scan')
    return
  }

  let removed = 0
  for (const root of roots) {
    const existing: string[] = []
    await collectPrunable(baseAbs, join(baseAbs, root), existing)
    for (const rel of existing) {
      if (written.has(rel)) continue
      if (DRY) {
        console.log(`would prune (stale): ${rel}`)
      } else {
        await rm(join(baseAbs, rel))
        console.log(`pruned (stale): ${rel}`)
      }
      removed++
    }
  }

  if (!DRY) {
    for (const root of roots) await removeEmptyDirs(baseAbs, join(baseAbs, root))
  }

  console.log(
    removed === 0
      ? 'prune: nothing stale'
      : `prune: ${DRY ? 'would remove' : 'removed'} ${removed} stale file(s)`,
  )
}

async function main() {
  const docId = resolveDocId()
  const parent = await api<{ data: { id: string; title: string; text: string } }>(
    'documents.info', { id: docId },
  )

  // Files live in child documents (one per top-level folder); the parent holds
  // only the tree. Parse the parent too (backward-compatible with the old
  // single-document format), then every child.
  const written = new Set<string>()
  let total = await writeSections(parent.data.text ?? '', written)

  const children = await api<{ data: { id: string; title: string }[] }>('documents.list', {
    parentDocumentId: parent.data.id, limit: 100,
  })
  for (const child of children.data) {
    const doc = await api<{ data: { text: string } }>('documents.info', { id: child.id })
    const n = await writeSections(doc.data.text ?? '', written)
    if (n > 0) console.log(`  · ${child.title}: ${n} file(s)`)
    total += n
  }

  console.log(`\n${DRY ? 'would reproduce' : 'reproduced'} ${total} file(s) from "${parent.data.title}" into ${OUT}/`)
  if (total === 0) {
    console.error('No "## `path`" sections found — was the doc created by outline:publish?')
    return
  }

  if (PRUNE) await pruneStale(written)
}

main().catch(e => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
