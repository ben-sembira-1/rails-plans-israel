/**
 * Validates references/manifest.json and every src/data/lines/*.json file:
 * - schema (zod, strict: unknown keys are errors);
 * - every `sources[].docId` exists in the manifest and `page` is within the document;
 * - every `image` path exists under public/;
 * - ids are unique; every manifest path exists on disk.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

import {
  CitedDocumentsSchema,
  LineSchema,
  ManifestSchema,
  type SourceRef,
} from '../src/data/schema.ts'

const ROOT = path.resolve(import.meta.dirname, '..')
const errors: string[] = []

const manifest = ManifestSchema.parse(
  JSON.parse(readFileSync(path.join(ROOT, 'references', 'manifest.json'), 'utf8')),
)
const docs = new Map(manifest.documents.map((d) => [d.id, d]))
if (docs.size !== manifest.documents.length) {
  errors.push('manifest: duplicate document ids')
}
for (const doc of manifest.documents) {
  if (!existsSync(path.join(ROOT, doc.path))) {
    errors.push(`manifest: missing file ${doc.path}`)
  }
}

const bundled = CitedDocumentsSchema.parse(
  JSON.parse(readFileSync(path.join(ROOT, 'src', 'data', 'documents.json'), 'utf8')),
)
const bundledIds = new Set(bundled.documents.map((d) => d.id))
for (const doc of bundled.documents) {
  const full = docs.get(doc.id)
  if (full?.path !== doc.path || full.originalUrl !== doc.originalUrl) {
    errors.push(`documents.json: ${doc.id} does not match the manifest (run npm run build-data)`)
  }
}

function checkSources(where: string, value: unknown): void {
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      checkSources(`${where}[${String(index)}]`, item)
    }
    return
  }
  if (typeof value !== 'object' || value === null) {
    return
  }
  const record = value as Record<string, unknown>
  if (typeof record['docId'] === 'string') {
    const source = record as unknown as SourceRef
    const doc = docs.get(source.docId)
    if (!bundledIds.has(source.docId)) {
      errors.push(
        `${where}: docId "${source.docId}" missing from documents.json (run npm run build-data)`,
      )
    }
    if (doc === undefined) {
      errors.push(`${where}: unknown docId "${source.docId}"`)
    } else if (source.page !== undefined && doc.pages !== undefined && source.page > doc.pages) {
      errors.push(`${where}: page ${String(source.page)} > ${String(doc.pages)} pages in ${doc.id}`)
    }
  }
  if (
    typeof record['image'] === 'string' &&
    !existsSync(path.join(ROOT, 'public', record['image']))
  ) {
    errors.push(`${where}: image not found public/${record['image']}`)
  }
  for (const [key, child] of Object.entries(record)) {
    checkSources(`${where}.${key}`, child)
  }
}

const linesDir = path.join(ROOT, 'src', 'data', 'lines')
const segmentIds = new Set<string>()
for (const file of readdirSync(linesDir).filter((f) => f.endsWith('.json'))) {
  const json: unknown = JSON.parse(readFileSync(path.join(linesDir, file), 'utf8'))
  const parsed = LineSchema.safeParse(json)
  if (!parsed.success) {
    errors.push(`${file}: ${parsed.error.message}`)
    continue
  }
  if (`${parsed.data.id}.json` !== file) {
    errors.push(`${file}: file name must be <line id>.json`)
  }
  for (const segment of parsed.data.segments) {
    if (segmentIds.has(segment.id)) {
      errors.push(`${file}: duplicate segment id ${segment.id}`)
    }
    segmentIds.add(segment.id)
  }
  checkSources(file, json)
}

if (errors.length > 0) {
  console.error(errors.join('\n'))
  process.exitCode = 1
} else {
  console.log(
    `data ok: ${String(manifest.documents.length)} documents, ${String(segmentIds.size)} segments`,
  )
}
