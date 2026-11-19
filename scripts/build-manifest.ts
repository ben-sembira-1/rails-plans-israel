/**
 * Walks references/raw/<collection>/** and (re)writes references/manifest.json.
 * Existing entries keep their id, title and retrievedAt when the file content (sha256) is unchanged.
 *
 * Usage: npm run build-manifest -- [--retrieved YYYY-MM-DD]
 */
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'

import { z } from 'zod'

import { ManifestSchema, type ManifestDocument } from '../src/data/schema.ts'

const ROOT = path.resolve(import.meta.dirname, '..')
const RAW = path.join(ROOT, 'references', 'raw')
const MANIFEST = path.join(ROOT, 'references', 'manifest.json')

const CollectionsSchema = z.object({
  collections: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      kind: z.enum(['onedrive', 'url']),
      remoteRoot: z.string().optional(),
      folderUrl: z.url(),
      /** Exact source URL per file (relative to the collection folder), when known. */
      fileUrls: z.record(z.string(), z.url()).optional(),
    }),
  ),
})

const ONEDRIVE_VIEW =
  'https://ntaisrael-my.sharepoint.com/personal/onedrive_nta_co_il/_layouts/15/onedrive.aspx'

function oneDriveFileUrl(remoteRoot: string, relative: string): string {
  const full = path.posix.join(remoteRoot, relative)
  const parent = path.posix.dirname(full)
  return `${ONEDRIVE_VIEW}?id=${encodeURIComponent(full)}&parent=${encodeURIComponent(parent)}`
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      return walk(full)
    }
    return entry.isFile() && entry.name !== '.DS_Store' ? [full] : []
  })
}

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag)
  return index === -1 ? undefined : process.argv[index + 1]
}

const today = argValue('--retrieved') ?? new Date().toISOString().slice(0, 10)
const { collections } = CollectionsSchema.parse(
  JSON.parse(readFileSync(path.join(ROOT, 'references', 'collections.json'), 'utf8')),
)
const previous = existsSync(MANIFEST)
  ? ManifestSchema.parse(JSON.parse(readFileSync(MANIFEST, 'utf8')))
  : undefined
const previousByKey = new Map(previous?.documents.map((d) => [`${d.sha256}:${d.path}`, d]))
const usedIds = new Set<string>()

const documents: ManifestDocument[] = []
for (const collection of collections) {
  const dir = path.join(RAW, collection.id)
  if (!existsSync(dir)) {
    console.warn(`collection folder missing: ${dir}`)
    continue
  }
  for (const file of walk(dir).toSorted()) {
    const relative = path.relative(dir, file).split(path.sep).join('/')
    const repoPath = path.relative(ROOT, file).split(path.sep).join('/')
    const sha256 = createHash('sha256').update(readFileSync(file)).digest('hex')
    const prior = previousByKey.get(`${sha256}:${repoPath}`)
    const originalUrl =
      collection.fileUrls?.[relative] ??
      (collection.kind === 'onedrive' && collection.remoteRoot !== undefined
        ? oneDriveFileUrl(collection.remoteRoot, relative)
        : collection.folderUrl)
    let id = prior?.id ?? `${collection.id}-${sha256.slice(0, 10)}`
    if (usedIds.has(id)) {
      // Identical content stored at another path: disambiguate with a hash of the path.
      id = `${id}-${createHash('sha256').update(repoPath).digest('hex').slice(0, 6)}`
    }
    usedIds.add(id)
    documents.push({
      id,
      title: prior?.title ?? relative,
      collection: collection.id,
      path: repoPath,
      originalUrl,
      sha256,
      bytes: statSync(file).size,
      retrievedAt: prior?.retrievedAt ?? today,
      ...(prior?.pages === undefined ? {} : { pages: prior.pages }),
    })
  }
}

const manifest = ManifestSchema.parse({ updatedAt: today, documents })
writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`manifest: ${String(documents.length)} documents`)
