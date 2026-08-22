import { NextResponse } from 'next/server'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { collectionByKey, deriveAlt, extOf, IMAGE_EXT, publicPath } from '@/lib/image-collections'

// Public: the homepage carousel reads its images from public/images/hero, so
// committing/removing a file there changes the carousel with no code edit.
export const dynamic = 'force-dynamic'

export async function GET() {
  const hero = collectionByKey('hero')!
  const dir = join(process.cwd(), 'public', 'images', hero.dir)
  try {
    const names = (await readdir(dir))
      .filter(n => IMAGE_EXT.has(extOf(n)))
      .sort((a, b) => a.localeCompare(b))
    const images = names.map(name => ({ src: publicPath(hero, name), alt: deriveAlt(name) }))
    return NextResponse.json({ images })
  } catch {
    return NextResponse.json({ images: [] })
  }
}
