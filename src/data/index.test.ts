import { documents, findDocument, findSegment, lines } from './index.ts'

describe('bundled data', () => {
  it('loads every line', () => {
    expect(lines.length).toBeGreaterThan(0)
    expect(documents.length).toBeGreaterThan(0)
  })

  it('cites only documents that exist in the manifest', () => {
    const json = JSON.stringify(lines)
    const ids = [...json.matchAll(/"docId":"([^"]+)"/gu)].map((m) => m[1] ?? '')
    expect(ids.length).toBeGreaterThan(0)
    for (const id of ids) {
      expect(findDocument(id), id).toBeDefined()
    }
  })

  it('gives every segment a timeline', () => {
    for (const line of lines) {
      for (const segment of line.segments) {
        expect(segment.phases.length + segment.milestones.length, segment.id).toBeGreaterThan(0)
        expect(findSegment(segment.id)?.line.id).toBe(line.id)
      }
    }
  })
})
