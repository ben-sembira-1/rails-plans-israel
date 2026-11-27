/** "הסגול – אלנבי" -> "אלנבי", "אתר M2 – תחנת הבימה" -> "אתר תחנת הבימה": when the line is already shown. */
export function shortName(name: string): string {
  return name.replace(/^(אתר )?(?:הקו )?(?:הסגול|הירוק|האדום|מטרו M\d|M\d)\s*[–-]\s*/, '$1');
}
