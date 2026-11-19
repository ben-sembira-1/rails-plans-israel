import { z } from 'zod'

/**
 * A date with an explicit precision: `YYYY`, `YYYY-Qn`, `YYYY-MM` or `YYYY-MM-DD`.
 * Planning documents rarely give exact days, so we keep the precision the source used.
 */
export const DateSpecSchema = z
  .string()
  .regex(/^\d{4}(?:-Q[1-4]|-(?:0[1-9]|1[0-2])(?:-(?:0[1-9]|[12]\d|3[01]))?)?$/u, {
    message: 'Expected YYYY, YYYY-Qn, YYYY-MM or YYYY-MM-DD',
  })
export type DateSpec = z.infer<typeof DateSpecSchema>

/** A pointer into a document listed in references/manifest.json. */
export const SourceRefSchema = z.strictObject({
  docId: z.string().min(1),
  page: z.number().int().positive().optional(),
  quote: z.string().min(1).optional(),
  note: z.string().min(1).optional(),
})
export type SourceRef = z.infer<typeof SourceRefSchema>

const Sources = z
  .array(SourceRefSchema)
  .min(1, { message: 'Every item must cite at least one source' })

const LngLatSchema = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)])
export type LngLat = z.infer<typeof LngLatSchema>

export const LineStringSchema = z.strictObject({
  type: z.literal('LineString'),
  coordinates: z.array(LngLatSchema).min(2),
})

export const PolygonSchema = z.strictObject({
  type: z.literal('Polygon'),
  coordinates: z.array(z.array(LngLatSchema).min(4)).min(1),
})

export const PhaseKindSchema = z.enum(['planning', 'construction', 'operational'])
export type PhaseKind = z.infer<typeof PhaseKindSchema>

export const PhaseSchema = z.strictObject({
  kind: PhaseKindSchema,
  label: z.string().min(1),
  start: DateSpecSchema,
  end: DateSpecSchema.optional(),
  sources: Sources,
})
export type Phase = z.infer<typeof PhaseSchema>

export const MilestoneSchema = z.strictObject({
  date: DateSpecSchema,
  label: z.string().min(1),
  sources: Sources,
})
export type Milestone = z.infer<typeof MilestoneSchema>

export const WorkAreaSchema = z.strictObject({
  id: z.string().min(1),
  name: z.string().min(1),
  geometry: PolygonSchema,
  start: DateSpecSchema,
  end: DateSpecSchema.optional(),
  sources: Sources,
})
export type WorkArea = z.infer<typeof WorkAreaSchema>

export const MaterialSchema = z.strictObject({
  kind: z.enum(['fact', 'quote', 'image', 'table']),
  title: z.string().min(1),
  body: z.string().min(1).optional(),
  /** Path relative to `public/`, e.g. `references/<docId>/page-3.webp`. */
  image: z.string().min(1).optional(),
  sources: Sources,
})
export type Material = z.infer<typeof MaterialSchema>

export const StationSchema = z.strictObject({
  name: z.string().min(1),
  nameHe: z.string().min(1).optional(),
  coordinates: LngLatSchema,
  sources: Sources,
})
export type Station = z.infer<typeof StationSchema>

export const GeometrySourceSchema = z.strictObject({
  kind: z.enum(['osm', 'traced', 'approximate']),
  ref: z.string().min(1),
  sources: Sources,
})

export const SegmentSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]+$/u),
  name: z.string().min(1),
  geometry: LineStringSchema,
  geometrySource: GeometrySourceSchema,
  stations: z.array(StationSchema),
  phases: z.array(PhaseSchema),
  milestones: z.array(MilestoneSchema),
  workAreas: z.array(WorkAreaSchema),
  materials: z.array(MaterialSchema),
})
export type Segment = z.infer<typeof SegmentSchema>

export const LineSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]+$/u),
  name: z.string().min(1),
  nameHe: z.string().min(1),
  mode: z.enum(['lrt', 'metro', 'brt']),
  color: z.string().regex(/^#[0-9a-f]{6}$/iu),
  description: z.string().min(1),
  sources: Sources,
  segments: z.array(SegmentSchema).min(1),
})
export type Line = z.infer<typeof LineSchema>

export const ManifestDocumentSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]+$/u),
  title: z.string().min(1),
  collection: z.string().min(1),
  /** Repo-relative path under references/raw. */
  path: z.string().startsWith('references/raw/'),
  originalUrl: z.url(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/u),
  bytes: z.number().int().nonnegative(),
  retrievedAt: z.iso.date(),
  pages: z.number().int().positive().optional(),
})
export type ManifestDocument = z.infer<typeof ManifestDocumentSchema>

/** The subset of manifest entries bundled with the site (src/data/documents.json). */
export const CitedDocumentSchema = ManifestDocumentSchema.omit({ sha256: true, bytes: true })
export type CitedDocument = z.infer<typeof CitedDocumentSchema>

export const CitedDocumentsSchema = z.strictObject({ documents: z.array(CitedDocumentSchema) })

export const ManifestSchema = z.strictObject({
  updatedAt: z.iso.date(),
  documents: z.array(ManifestDocumentSchema),
})
export type Manifest = z.infer<typeof ManifestSchema>
