/**
 * Décomposition d'acceptation IA (affichée dans l'UI : « pourquoi l'IA
 * accepte ou refuse »).
 */
export interface AcceptRow {
  key: string;
  value: number;
}

export interface Acceptance {
  score: number;
  accept: boolean;
  rows: AcceptRow[];
}

export function acceptance(rows: AcceptRow[]): Acceptance {
  const filtered = rows.filter((r) => Math.round(r.value) !== 0).map((r) => ({ key: r.key, value: Math.round(r.value) }));
  const score = filtered.reduce((s, r) => s + r.value, 0);
  return { score, accept: score >= 0, rows: filtered };
}
