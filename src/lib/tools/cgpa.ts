// CGPA → percentage. Universities and boards use different formulas: always use the one
// printed on your marksheet or required by the notification.

export const CGPA_FORMULAS = [
  { id: 'cbse', label: 'CBSE (CGPA × 9.5)', scale: 10, convert: (c: number) => c * 9.5 },
  { id: 'x10', label: 'CGPA × 10', scale: 10, convert: (c: number) => c * 10 },
  { id: 'minus075', label: '(CGPA − 0.75) × 10', scale: 10, convert: (c: number) => (c - 0.75) * 10 },
  { id: 'scale4', label: '4-point scale (CGPA ÷ 4 × 100)', scale: 4, convert: (c: number) => (c / 4) * 100 },
] as const;

export type CgpaFormulaId = (typeof CGPA_FORMULAS)[number]['id'];

/** Percentage rounded to 2 decimals, or null if the CGPA is out of range for the formula. */
export function cgpaToPercent(cgpa: number, formulaId: CgpaFormulaId | 'custom', customFactor?: number): number | null {
  if (!Number.isFinite(cgpa) || cgpa < 0) return null;
  let pct: number;
  if (formulaId === 'custom') {
    if (!customFactor || customFactor <= 0) return null;
    pct = cgpa * customFactor;
  } else {
    const f = CGPA_FORMULAS.find((x) => x.id === formulaId)!;
    if (cgpa > f.scale) return null;
    pct = f.convert(cgpa);
  }
  return Math.round(Math.max(0, Math.min(100, pct)) * 100) / 100;
}
