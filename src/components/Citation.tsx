import type { JSX } from 'react'

import { findDocument } from '../data/index.ts'
import { archivedFileUrl, pageImageUrl } from '../data/links.ts'
import type { SourceRef } from '../data/schema.ts'

export function Citation({ source }: { source: SourceRef }): JSX.Element {
  const doc = findDocument(source.docId)
  if (doc === undefined) {
    return <span className="citation citation--missing">Unknown source {source.docId}</span>
  }
  const pageLabel = source.page === undefined ? '' : `, p. ${String(source.page)}`
  return (
    <span className="citation">
      <a href={archivedFileUrl(doc)} target="_blank" rel="noreferrer" title={doc.path}>
        {doc.title}
        {pageLabel}
      </a>
      {' · '}
      <a href={doc.originalUrl} target="_blank" rel="noreferrer">
        original
      </a>
      {source.page !== undefined && doc.path.toLowerCase().endsWith('.pdf') ? (
        <>
          {' · '}
          <a href={pageImageUrl(doc.id, source.page)} target="_blank" rel="noreferrer">
            page image
          </a>
        </>
      ) : null}
      {source.quote === undefined ? null : <q className="citation__quote">{source.quote}</q>}
      {source.note === undefined ? null : <span className="citation__note">{source.note}</span>}
    </span>
  )
}

export function Citations({ sources }: { sources: readonly SourceRef[] }): JSX.Element {
  return (
    <span className="citations">
      <span className="citations__label">Source{sources.length > 1 ? 's' : ''}:</span>
      {sources.map((source, index) => (
        <Citation
          key={`${source.docId}-${String(source.page ?? 0)}-${String(index)}`}
          source={source}
        />
      ))}
    </span>
  )
}
