import type { ManifestDocument } from './schema.ts'

const REPO = 'ben-sembira-1/rails-plans-israel'

/** Direct link to the archived copy of a document (Git LFS content served by GitHub). */
export function archivedFileUrl(doc: ManifestDocument): string {
  const encodedPath = doc.path
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/')
  return `https://media.githubusercontent.com/media/${REPO}/master/${encodedPath}`
}

/** Link to the extracted page image bundled with the site. */
export function pageImageUrl(docId: string, page: number): string {
  return `${import.meta.env.BASE_URL}references/${encodeURIComponent(docId)}/page-${String(page)}.webp`
}

/** Link to an image path stored relative to `public/`. */
export function publicUrl(relativePath: string): string {
  return `${import.meta.env.BASE_URL}${relativePath}`
}
