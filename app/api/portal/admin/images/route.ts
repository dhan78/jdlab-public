import { NextRequest, NextResponse } from 'next/server'
import { readdir, writeFile, unlink, mkdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { getSessionFromCookies, verifySessionToken } from '@/lib/portal-auth'
import type { SessionPayload } from '@/lib/portal-auth'
import { recordAudit } from '@/lib/audit'
import { clientIp } from '@/lib/rate-limit'
import {
  IMAGE_COLLECTIONS,
  IMAGE_EXT,
  collectionByKey,
  extOf,
  publicPath,
  type ImageCollection,
} from '@/lib/image-collections'

// Admin tool: save browser-optimized marketing photos into a collection folder
// under public/images/ (see lib/image-collections.ts). The RESIZE/COMPRESS
// happens client-side (Canvas), so this route just validates + writes bytes —
// no server-side sharp needed.
//
// This writes into the repo working tree, so it's a LOCAL/DEV workflow: run the
// app locally, drop photos, commit public/images, redeploy. In the deployed
// (standalone) container the public dir is baked into the image and not the
// repo, so runtime writes wouldn't persist — hence dev-only.

const PUBLIC_IMAGES = join(process.cwd(), 'public', 'images')
const MAX_BYTES = 6 * 1024 * 1024 // client already shrinks well under this

function dirFor(c: ImageCollection): string {
  return c.dir ? join(PUBLIC_IMAGES, c.dir) : PUBLIC_IMAGES
}

async function requireAdmin(request: NextRequest): Promise<SessionPayload | NextResponse> {
  const token = getSessionFromCookies(request.headers.get('cookie'))
  const session = token ? await verifySessionToken(token) : null
  if (!session) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  if (session.role !== 'admin') return NextResponse.json({ error: 'Admins only' }, { status: 403 })
  return session
}

// Reject anything but a bare, safe basename (no path traversal / subfolders).
function sanitizeName(raw: string): string | null {
  const base = raw.trim().toLowerCase().replace(/\s+/g, '-')
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(base)) return null
  if (!IMAGE_EXT.has(extOf(base))) return null
  if (base.includes('..') || base.includes('/') || base.includes('\\')) return null
  return base
}

// List only files that live directly in a collection's folder (non-recursive),
// so 'general' (the root) never picks up images that belong to a subfolder.
async function listCollection(c: ImageCollection) {
  const dir = dirFor(c)
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    const images = await Promise.all(
      entries
        .filter(e => e.isFile() && IMAGE_EXT.has(extOf(e.name)))
        .map(async e => {
          const s = await stat(join(dir, e.name)).catch(() => null)
          return { name: e.name, path: publicPath(c, e.name), size: s?.size ?? 0 }
        }),
    )
    images.sort((a, b) => a.name.localeCompare(b.name))
    return images
  } catch {
    return []
  }
}

// GET: images grouped by collection (admin only).
export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (admin instanceof NextResponse) return admin
  const collections = await Promise.all(
    IMAGE_COLLECTIONS.map(async c => ({
      key: c.key,
      label: c.label,
      managed: c.managed,
      images: await listCollection(c),
    })),
  )
  return NextResponse.json({ collections })
}

// POST: write one browser-optimized image into a collection.
// Body: { collection, name, dataUrl } (dataUrl already resized/compressed).
export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (admin instanceof NextResponse) return admin

  // Dev-only: writing to the repo's public dir doesn't persist in the container.
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Run this locally: images are saved into public/images (a versioned asset), then commit + deploy.' },
      { status: 409 },
    )
  }

  let body: { collection?: unknown; name?: unknown; dataUrl?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }
  const collection = collectionByKey(typeof body.collection === 'string' ? body.collection : '')
  if (!collection) return NextResponse.json({ error: 'Unknown collection' }, { status: 400 })
  const name = sanitizeName(typeof body.name === 'string' ? body.name : '')
  const dataUrl = typeof body.dataUrl === 'string' ? body.dataUrl : ''
  if (!name) return NextResponse.json({ error: 'Bad filename (use letters/numbers/-/_ and .webp/.jpg/.png)' }, { status: 400 })
  const m = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(dataUrl)
  if (!m) return NextResponse.json({ error: 'Expected a base64 image data URL' }, { status: 400 })

  const bytes = Buffer.from(m[2], 'base64')
  if (bytes.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: `Too large (${(bytes.byteLength / 1024 / 1024).toFixed(1)}MB > 6MB)` }, { status: 413 })
  }

  const dir = dirFor(collection)
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, name), bytes)
  await recordAudit({
    actorId: admin.sub,
    actorRole: admin.role,
    action: 'marketing_image.upload',
    detail: `${collection.key}/${name} (${Math.round(bytes.byteLength / 1024)}KB)`,
    ip: clientIp(request),
  })
  return NextResponse.json(
    { image: { name, path: publicPath(collection, name), size: bytes.byteLength } },
    { status: 201 },
  )
}

// DELETE: remove an image by ?collection=&name= (admin only, dev-only).
export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (admin instanceof NextResponse) return admin
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Run locally, then commit the removal.' }, { status: 409 })
  }
  const params = new URL(request.url).searchParams
  const collection = collectionByKey(params.get('collection') ?? '')
  if (!collection) return NextResponse.json({ error: 'Unknown collection' }, { status: 400 })
  const name = sanitizeName(params.get('name') ?? '')
  if (!name) return NextResponse.json({ error: 'Bad filename' }, { status: 400 })
  await unlink(join(dirFor(collection), name)).catch(() => {})
  await recordAudit({
    actorId: admin.sub,
    actorRole: admin.role,
    action: 'marketing_image.delete',
    detail: `${collection.key}/${name}`,
    ip: clientIp(request),
  })
  return NextResponse.json({ ok: true })
}
