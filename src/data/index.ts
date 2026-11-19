import documentsJson from './documents.json'
import {
  LineSchema,
  CitedDocumentsSchema,
  type CitedDocument,
  type Line,
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

/** Documents cited by the bundled data (a subset of references/manifest.json). */
export const documents: readonly CitedDocument[] =
  CitedDocumentsSchema.parse(documentsJson).documents

const documentsById = new Map(documents.map((d) => [d.id, d]))

export function findDocument(docId: string): CitedDocument | undefined {
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
