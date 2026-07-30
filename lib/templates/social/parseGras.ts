// Balisage minimal du gras partiel : **texte** au milieu d'une ligne en italique.
// Utilisé par l'aperçu du formulaire de validation (phase 3) ET par le rendu
// Satori (phase 4) — une seule implémentation, donc un aperçu fidèle.

export type Segment = { texte: string; gras: boolean };

const MARQUEUR = /\*\*(.+?)\*\*/g;

export function parseGras(texte: string): Segment[] {
  const segments: Segment[] = [];
  let dernier = 0;
  for (const m of texte.matchAll(MARQUEUR)) {
    const i = m.index;
    if (i > dernier) segments.push({ texte: texte.slice(dernier, i), gras: false });
    segments.push({ texte: m[1], gras: true });
    dernier = i + m[0].length;
  }
  if (dernier < texte.length) segments.push({ texte: texte.slice(dernier), gras: false });
  return segments;
}

// Texte sans le balisage. Les astérisques comptent dans les limites du gabarit
// (c'est la ligne complète qui est mesurée), mais pas dans ce qui s'affiche.
export function sansGras(texte: string): string {
  return texte.replace(MARQUEUR, "$1");
}
