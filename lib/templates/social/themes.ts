// Les thèmes du post social. Chacun est un FRAME PNG de public/frames/ : il
// contient déjà le cadre, le dégradé, le voile et le bloc signature. Le gabarit
// ne dessine plus aucun de ces éléments — il ne place que du texte.
//
// AJOUTER UN THÈME = deux gestes, rien d'autre :
//   1. déposer le PNG (1080 × 1350, RGBA, même géométrie) dans public/frames/
//   2. ajouter son identifiant à THEME_IDS et son entrée à THEMES
// Le schéma Zod, le formulaire de validation et les pastilles de l'interface
// se mettent à jour tout seuls : ils dérivent tous de THEME_IDS.
//
// Ce module ne dépend de rien : c'est la source, pas un consommateur.

export const THEME_IDS = [
  "azur",
  "sarcelle",
  "lagon",
  "menthe",
  "olive",
  "prune",
  "framboise",
] as const;

export type ThemeT = (typeof THEME_IDS)[number];

export type Theme = {
  nom: string;
  fichier: string;
  /** Couleur moyenne de la bordure, mesurée sur le PNG. Sert aux pastilles. */
  dominante: string;
};

export const THEMES: Record<ThemeT, Theme> = {
  azur: { nom: "Azur", fichier: "azur.png", dominante: "#29B9BC" },
  sarcelle: { nom: "Sarcelle", fichier: "sarcelle.png", dominante: "#72C6E5" },
  lagon: { nom: "Lagon", fichier: "lagon.png", dominante: "#40A2CE" },
  menthe: { nom: "Menthe", fichier: "menthe.png", dominante: "#53A981" },
  olive: { nom: "Olive", fichier: "olive.png", dominante: "#89CDA1" },
  prune: { nom: "Prune", fichier: "prune.png", dominante: "#79BACF" },
  framboise: { nom: "Framboise", fichier: "framboise.png", dominante: "#835661" },
};

export const NOMS_THEMES = THEME_IDS.map((valeur) => ({ valeur, nom: THEMES[valeur].nom }));

// Géométrie commune aux sept frames, mesurée sur les fichiers (canal alpha) :
// le contenu doit rester dans ces limites sous peine de passer sous le cadre ou
// sous la signature.
export const GEOMETRIE = {
  largeur: 1080,
  hauteur: 1350,
  /** Bandeau opaque en haut du frame : c'est là que se pose le titre. */
  bandeauHaut: 211,
  /** Épaisseur du cadre sur les côtés et en bas. */
  bordure: 22,
  /**
   * Le coin supérieur gauche de la fenêtre est coupé en diagonale : son bord
   * gauche descend de x=178 (y=215) à x=22 (y=400). En dessous de cette ligne
   * seulement, le contenu peut être calé contre la bordure intérieure.
   */
  contenuHaut: 400,
  /** Le bloc signature occupe le bas à partir de cette abscisse. */
  signatureX: 560,
} as const;
