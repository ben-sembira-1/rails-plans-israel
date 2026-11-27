import type { ConstructionLayer } from '../domain/construction.ts';

/** One line for the status section: what is being built at the selected time. */
export function constructionSummary(counts: Readonly<Record<ConstructionLayer, number>>): string {
  const n = (x: number) => x.toLocaleString('he-IL');
  return [
    `${n(counts.construction)} אתרי בנייה פעילים`,
    `${n(counts.permitted)} היתרים שטרם החלו`,
    `${n(counts.road)} עבודות כביש`,
  ].join(' · ');
}
