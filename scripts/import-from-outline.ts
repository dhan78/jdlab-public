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
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, resolve, relative, isAbsolute } from 'node:path'

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
const OUT = arg('out', 'outline-export')

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
async function writeSections(text: string): Promise<number> {
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

async function main() {
  const docId = resolveDocId()
  const parent = await api<{ data: { id: string; title: string; text: string } }>(
    'documents.info', { id: docId },
  )

  // Files live in child documents (one per top-level folder); the parent holds
  // only the tree. Parse the parent too (backward-compatible with the old
  // single-document format), then every child.
  let total = await writeSections(parent.data.text ?? '')

  const children = await api<{ data: { id: string; title: string }[] }>('documents.list', {
    parentDocumentId: parent.data.id, limit: 100,
  })
  for (const child of children.data) {
    const doc = await api<{ data: { text: string } }>('documents.info', { id: child.id })
    const n = await writeSections(doc.data.text ?? '')
    if (n > 0) console.log(`  · ${child.title}: ${n} file(s)`)
    total += n
  }

  console.log(`\n${DRY ? 'would reproduce' : 'reproduced'} ${total} file(s) from "${parent.data.title}" into ${OUT}/`)
  if (total === 0) console.error('No "## `path`" sections found — was the doc created by outline:publish?')
}

main().catch(e => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
