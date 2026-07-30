import type { ThemeT } from "./schema";

// Les six thèmes de couleur, relevés à la pipette sur les posts Canva existants
// (bordures des quatre captures de fixtures/posts/, points contaminés par la photo
// écartés). Olive et prune n'apparaissaient dans aucune capture : leurs valeurs
// sont dérivées sur la même recette — teinte claire et saturée à gauche, la même
// assombrie à droite.
//
// Le dégradé du cadre est HORIZONTAL (gauche → droite), pas diagonal : c'est ce
// que font les originaux.

export type Theme = {
  nom: string;
  gauche: string; // départ du dégradé de bordure
  droite: string; // arrivée — sert aussi d'accent (flèche du bandeau, icône du badge)
};

export const THEMES: Record<ThemeT, Theme> = {
  framboise: { nom: "Framboise", gauche: "#ED3A53", droite: "#852352" },
  sarcelle: { nom: "Sarcelle", gauche: "#89C4BE", droite: "#3A575A" },
  azur: { nom: "Azur", gauche: "#4EC167", droite: "#1A61A8" },
  ambre: { nom: "Ambre", gauche: "#F7953F", droite: "#A4400F" },
  olive: { nom: "Olive", gauche: "#8BC34A", droite: "#33691E" },
  prune: { nom: "Prune", gauche: "#CE93D8", droite: "#6A1B9A" },
};

export const NOMS_THEMES = Object.entries(THEMES).map(([cle, t]) => ({
  valeur: cle as ThemeT,
  nom: t.nom,
}));
