/**
 * Sync repo files into ONE Outline document via the API, preserving the folder
 * structure so the tree can be reproduced on another machine.
 *
 * The document gets:
 *   1. a directory tree (```text fence),
 *   2. one section per file titled with its full forward-slash relative path,
 *      code fenced by language (.md inlined as-is).
 * Idempotent: re-running replaces the body so it mirrors the current repo.
 *
 * A companion importer can parse the "## `path`" + fenced-block format to
 * recreate files at their paths — see scripts/import-from-outline.ts.
 *
 * Env (put OUTLINE_* in .env.local):
 *   OUTLINE_URL          API base. Yours: https://docs.jdlab.us/api
 *   OUTLINE_TOKEN        API token (Outline → Settings → API Tokens)  [required]
 *   OUTLINE_DOCUMENT_ID  urlId at the end of the doc URL (…/doc/jdlab-ZereHWBBc7
 *                        → ZereHWBBc7) or the UUID.
 *   OUTLINE_DOCUMENT_URL Alternatively the full doc URL (parsed for the id).
 *
 * Usage:
 *   npm run outline:publish                     # default roots below (full sync)
 *   npm run outline:publish -- app lib README.md   # specific files/dirs
 *
 * Passing explicit targets is a PARTIAL publish: only those top-level folders'
 * child documents are rewritten; every other child doc is left untouched, and
 * the parent index tree is MERGED (kept complete) rather than shrunk to just the
 * folders passed. Pass whole FOLDERS (e.g. `components`), not single files — a
 * folder's child doc is always rewritten in full, so publishing one file would
 * drop its siblings from that page.
 */
import { readFile, readdir, stat } from 'node:fs/promises'
import { extname, join, relative, sep } from 'node:path'

const API = (process.env.OUTLINE_URL ?? 'https://app.getoutline.com/api').replace(/\/+$/, '')
const TOKEN = process.env.OUTLINE_TOKEN
const ROOT = process.cwd()
const MAX_BYTES = 256 * 1024 // skip files larger than this

// Default roots walked when nothing is passed on the CLI.
const DEFAULT_TARGETS = [
  'app', 'components', 'lib', 'drizzle', 'scripts', 'tests', 'specs',
  'deploy', 'test-fixtures',
  'middleware.ts', 'next.config.ts', 'tailwind.config.ts', 'postcss.config.js',
  'drizzle.config.ts', 'tsconfig.json', 'package.json',
  'docker-compose.yml', 'Dockerfile', 'Caddyfile', 'README.md', 'HANDOFF.md',
]

const IGNORE_DIRS = new Set([
  'node_modules', '.git', '.next', 'dist', 'build', 'out', 'coverage',
  '.turbo', '.vercel', 'public', '.agents',
])
const IGNORE_FILES = new Set([
  'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'next-env.d.ts',
])
const IGNORE_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.woff', '.woff2',
  '.ttf', '.otf', '.pdf', '.zip', '.gz', '.mp4', '.mov', '.lock',
])

// Never leak secrets.
function isSecret(rel: string): boolean {
  const base = rel.split('/').pop() ?? ''
  return base === '.env' || base.startsWith('.env.')
}

const LANG: Record<string, string> = {
  '.ts': 'ts', '.tsx': 'tsx', '.js': 'js', '.jsx': 'jsx', '.mjs': 'js',
  '.json': 'json', '.css': 'css', '.scss': 'scss', '.html': 'html',
  '.sql': 'sql', '.yml': 'yaml', '.yaml': 'yaml', '.sh': 'bash', '.toml': 'toml',
  '.svg': 'xml',
}

if (!TOKEN) {
  console.error('ERROR: OUTLINE_TOKEN is required (Outline → Settings → API Tokens).')
  process.exit(1)
}

function toRel(abs: string): string {
  return relative(ROOT, abs).split(sep).join('/')
}

async function walk(absPath: string, out: string[]): Promise<void> {
  const rel = toRel(absPath)
  const base = rel.split('/').pop() ?? rel
  const s = await stat(absPath)
  if (s.isDirectory()) {
    if (IGNORE_DIRS.has(base)) return
    for (const entry of await readdir(absPath)) {
      await walk(join(absPath, entry), out)
    }
    return
  }
  // file
  if (IGNORE_FILES.has(base) || IGNORE_EXT.has(extname(base).toLowerCase())) return
  if (isSecret(rel)) return
  if (s.size > MAX_BYTES) {
    console.error(`skip (too large ${(s.size / 1024).toFixed(0)}KB): ${rel}`)
    return
  }
  out.push(rel)
}

function resolveDocId(): string {
  const raw = process.env.OUTLINE_DOCUMENT_URL ?? process.env.OUTLINE_DOCUMENT_ID
  if (!raw) {
    console.error('ERROR: set OUTLINE_DOCUMENT_ID (urlId, e.g. ZereHWBBc7) or OUTLINE_DOCUMENT_URL.')
    process.exit(1)
  }
  if (raw.includes('/doc/')) {
    const slug = raw.split('/doc/')[1].split(/[?#]/)[0]
    return slug.split('-').pop() as string
  }
  return raw
}

async function api<T = unknown>(method: string, body: unknown): Promise<T> {
  const attempts = 5
  for (let i = 1; i <= attempts; i++) {
    const res = await fetch(`${API}/${method}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) return res.json() as Promise<T>
    const detail = await res.text().catch(() => '')
    // Retry transient gateway/server errors (502/503/504) with backoff.
    if ([502, 503, 504, 429].includes(res.status) && i < attempts) {
      const wait = 1000 * 2 ** (i - 1)
      console.log(`  ↻ ${method} ${res.status}; retry ${i}/${attempts - 1} in ${wait}ms`)
      await new Promise(r => setTimeout(r, wait))
      continue
    }
    throw new Error(`${method} → ${res.status} ${res.statusText} ${detail}`)
  }
  throw new Error(`${method} → exhausted retries`)
}

function renderTree(paths: string[]): string {
  type Node = { [k: string]: Node }
  const root: Node = {}
  for (const p of paths) {
    let node = root
    for (const part of p.split('/')) node = node[part] ??= {}
  }
  const lines: string[] = ['.']
  const draw = (node: Node, prefix: string) => {
    const keys = Object.keys(node).sort()
    keys.forEach((k, i) => {
      const last = i === keys.length - 1
      lines.push(`${prefix}${last ? '└── ' : '├── '}${k}`)
      draw(node[k], prefix + (last ? '    ' : '│   '))
    })
  }
  draw(root, '')
  return lines.join('\n')
}

function section(path: string, content: string): string {
  const ext = extname(path).toLowerCase()
  const trimmed = content.replace(/\s+$/, '')
  const lang =
    ext === '.md' || ext === '.markdown'
      ? 'markdown'
      : LANG[ext] ?? (path.toLowerCase().includes('dockerfile') ? 'dockerfile' : '')
  // Fence every file (incl. Markdown) so Outline stores it verbatim — raw
  // Markdown gets normalized, breaking exact reproduction. The fence is one
  // backtick longer than the longest backtick run inside the file, so content
  // that itself contains ``` (e.g. this script) can't close the fence early.
  let maxTicks = 0
  for (const run of trimmed.matchAll(/`+/g)) maxTicks = Math.max(maxTicks, run[0].length)
  const fence = '`'.repeat(Math.max(3, maxTicks + 1))
  return `## \`${path}\`\n\n${fence}${lang}\n${trimmed}\n${fence}\n`
}

const MAX_CHUNK = 40_000 // bytes of text per update request (gateway rejects large bodies)

// Group file sections into <=MAX_CHUNK bodies, split at section boundaries.
function buildChunks(sections: string[]): string[] {
  const chunks: string[] = []
  let cur = ''
  for (const s of sections) {
    const piece = (cur ? '\n---\n\n' : '') + s
    if (cur && Buffer.byteLength(cur + piece) > MAX_CHUNK) {
      chunks.push(cur)
      cur = s
    } else {
      cur += piece
    }
  }
  if (cur) chunks.push(cur)
  return chunks
}

// Replace a document body with header + sections, chunked (first replaces, rest append).
async function replaceDocBody(id: string, header: string, sections: string[]): Promise<number> {
  const chunks = buildChunks(sections)
  await api('documents.update', { id, text: header + (chunks[0] ?? ''), append: false })
  for (let i = 1; i < chunks.length; i++) {
    await new Promise(r => setTimeout(r, 400)) // let the gateway/server settle between appends
    await api('documents.update', { id, text: `\n---\n\n${chunks[i]}`, append: true })
  }
  return chunks.length
}

// Idempotently find (by title) or create a child document under the parent.
async function findOrCreateChild(parentId: string, collectionId: string, title: string): Promise<string> {
  const list = await api<{ data: { id: string; title: string }[] }>('documents.list', {
    parentDocumentId: parentId, limit: 100,
  })
  const existing = list.data.find(d => d.title === title)
  if (existing) return existing.id
  const created = await api<{ data: { id: string } }>('documents.create', {
    title, collectionId, parentDocumentId: parentId, text: '', publish: true,
  })
  return created.data.id
}

// Top-level segment of a path; root-level files grouped under "root".
function topOf(rel: string): string {
  const i = rel.indexOf('/')
  return i === -1 ? 'root' : rel.slice(0, i)
}

// Recover the file paths already published in Outline, from every child document
// EXCEPT the folders being (re)published now. Used on a PARTIAL publish so the
// parent index tree can be MERGED (kept whole) instead of shrunk to just the
// folders passed on the CLI. Child docs are titled by their top-level folder.
async function existingTreeFilesExcluding(
  parentId: string,
  excludeGroups: Set<string>,
): Promise<string[]> {
  const list = await api<{ data: { id: string; title: string }[] }>('documents.list', {
    parentDocumentId: parentId,
    limit: 100,
  })
  const out: string[] = []
  for (const child of list.data) {
    if (excludeGroups.has(child.title)) continue // this folder is being refreshed now
    const doc = await api<{ data: { text: string } }>('documents.info', { id: child.id })
    for (const m of (doc.data.text ?? '').matchAll(/^## `([^`]+)`/gm)) {
      out.push(m[1].trim())
    }
  }
  return out
}

async function main() {
  const docId = resolveDocId()
  // Separate CLI flags from folder/file targets. Passing explicit targets is a
  // PARTIAL publish: only those top-level folders' child docs are rewritten and
  // the parent index tree is MERGED (not replaced) so the overview stays whole.
  const argv = process.argv.slice(2)
  const argTargets = argv.filter(a => !a.startsWith('--'))
  const isPartial = argTargets.length > 0
  const targets = isPartial ? argTargets : DEFAULT_TARGETS

  const files: string[] = []
  for (const t of targets) {
    try {
      await walk(join(ROOT, t), files)
    } catch {
      console.error(`skip (not found): ${t}`)
    }
  }
  const unique = [...new Set(files)].sort()
  if (unique.length === 0) {
    console.error('Nothing to sync.')
    process.exit(1)
  }
  for (const rel of unique) console.log(`+ ${rel}`)

  // A single Outline document can't hold the whole repo (gateway 502 past ~560KB),
  // so publish a parent index doc + one child document per top-level folder.
  const info = await api<{ data: { id: string; title: string; url: string; collectionId: string } }>(
    'documents.info', { id: docId },
  )
  const parentId = info.data.id
  const collectionId = info.data.collectionId

  const groups = new Map<string, string[]>()
  for (const rel of unique) {
    const top = topOf(rel)
    ;(groups.get(top) ?? groups.set(top, []).get(top)!).push(rel)
  }
  const groupNames = [...groups.keys()].sort()

  // On a partial publish, merge the freshly-walked files with the files already
  // held in the OTHER child docs, so the parent index tree stays complete.
  // (Files under the republished folders come only from this walk, so
  // additions/removals within them are reflected.)
  let treeFiles = unique
  if (isPartial) {
    const kept = await existingTreeFilesExcluding(parentId, new Set(groupNames))
    treeFiles = [...new Set([...kept, ...unique])].sort()
  }
  const treeGroupCount = new Set(treeFiles.map(topOf)).size

  const stamp = new Date().toISOString()
  const tree = renderTree(treeFiles)
  const parentHeader =
    `> Synced from the jdlab repo · ${stamp} · ${treeFiles.length} file(s) across ${treeGroupCount} section(s)` +
    `${isPartial ? ` · partial publish: ${groupNames.join(', ')}` : ''}\n\n` +
    `Each top-level folder is a **child document** below. Run \`npm run outline:import\` to reproduce the tree.\n\n` +
    `# Repository structure\n\n\`\`\`text\n${tree}\n\`\`\`\n`
  await api('documents.update', { id: parentId, text: parentHeader, append: false })
  console.log(`\nindex: "${info.data.title}"  ${info.data.url}${isPartial ? '  (partial — tree merged)' : ''}`)

  for (const g of groupNames) {
    const rels = groups.get(g)!.slice().sort()
    const sections: string[] = []
    for (const rel of rels) {
      const content = await readFile(join(ROOT, rel), 'utf8')
      sections.push(section(rel, content))
    }
    const childId = await findOrCreateChild(parentId, collectionId, g)
    const header = `> \`${g}\` · ${rels.length} file(s) · ${stamp}\n\n# Files\n\n`
    const nChunks = await replaceDocBody(childId, header, sections)
    console.log(`  ✓ ${g}  (${rels.length} files, ${nChunks} chunk${nChunks === 1 ? '' : 's'})`)
  }
  console.log(
    `\nDone: ${isPartial ? 'partial ' : ''}sync of ${unique.length} file(s) across ` +
      `${groupNames.length} child document(s)${isPartial ? ` (${treeFiles.length} in the merged index tree)` : ''}.`,
  )
}

main().catch(e => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
