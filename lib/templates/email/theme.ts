// Charte du gabarit courriel, relevée sur les deux références de
// fixtures/email/ (Luxe Lumineux 1 et 2) : fond crème, filet doré, encre
// sombre, serif pour le nom de l'offre.
//
// RÈGLE OUTLOOK — aucun emoji dans les gabarits. Outlook pour Windows les rend
// en noir et blanc ou en carrés vides selon la version. Les références en
// utilisaient (📅 ✈️ 🥂) ; ils sont remplacés par des libellés en gras.

export const COULEURS = {
  fond: "#f4f5f7",
  carte: "#ffffff",
  creme: "#fdfbf7",
  or: "#c2a661",
  orSombre: "#8a7a5f",
  encre: "#1a202c",
  texte: "#2d3748",
  gris: "#718096",
  grisClair: "#a0aec0",
  filet: "#eae5d9",
} as const;

export const POLICES = {
  corps: "'Helvetica Neue', Helvetica, Arial, sans-serif",
  titre: "Georgia, 'Times New Roman', serif",
} as const;

export const LARGEUR = 600;

// Montant à la québécoise : espace insécable comme séparateur de milliers,
// symbole après. « 1 745 $ ».
export function montant(valeur: number): string {
  return `${Math.round(valeur).toLocaleString("fr-CA").replace(/ | /g, "&nbsp;")}&nbsp;$`;
}

// Échappe ce qui part dans le HTML : les textes viennent de la fiche, donc de
// l'opérateur, et un « & » ou un « < » casserait le courriel.
export function html(texte: string): string {
  return texte
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
