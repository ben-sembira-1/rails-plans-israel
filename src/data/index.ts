import manifestJson from '../../references/manifest.json'

import {
  LineSchema,
  ManifestSchema,
  type Line,
  type Manifest,
  type ManifestDocument,
  type Segment,
} from './schema.ts'

const lineModules = import.meta.glob<unknown>('./lines/*.json', { eager: true, import: 'default' })

export const lines: readonly Line[] = Object.entries(lineModules)
  .toSorted(([a], [b]) => a.localeCompare(b))
  .map(([file, json]) => {
    const parsed = LineSchema.safeParse(json)
    if (!parsed.success) {
      throw new Error(`Invalid line data in ${file}: ${parsed.error.message}`)
    }
    return parsed.data
  })

export const manifest: Manifest = ManifestSchema.parse(manifestJson)

const documentsById = new Map(manifest.documents.map((d) => [d.id, d]))

export function findDocument(docId: string): ManifestDocument | undefined {
  return documentsById.get(docId)
}

export interface SegmentRef {
  line: Line
  segment: Segment
}

export function findSegment(segmentId: string): SegmentRef | undefined {
  for (const line of lines) {
    const segment = line.segments.find((s) => s.id === segmentId)
    if (segment !== undefined) {
      return { line, segment }
    }
  }
  return undefined
}
