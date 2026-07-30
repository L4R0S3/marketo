import type { ThemeT } from "./schema";

// ⚠️ VALEURS PROVISOIRES — CLAUDE.md §12 liste « les valeurs hexadécimales exactes
// des six thèmes » parmi les points à clarifier AVANT la phase 4. Celles-ci sont
// des approximations relevées à l'œil sur les posts existants, uniquement pour que
// l'aperçu du formulaire de validation ne soit pas gris. Elles ne doivent pas être
// reprises telles quelles dans le rendu final : remplace-les par les valeurs de
// marque, puis régénère les six SVG de signature (/public/signature/).

export type Theme = {
  nom: string;
  cadreDe: string; // départ du dégradé de bordure
  cadreVers: string; // arrivée du dégradé
  accent: string; // teinte du bandeau et des accents
};

export const THEMES: Record<ThemeT, Theme> = {
  framboise: { nom: "Framboise", cadreDe: "#c2185b", cadreVers: "#7b1fa2", accent: "#ad1457" },
  sarcelle: { nom: "Sarcelle", cadreDe: "#00838f", cadreVers: "#26a69a", accent: "#00695c" },
  azur: { nom: "Azur", cadreDe: "#0277bd", cadreVers: "#26c6da", accent: "#01579b" },
  ambre: { nom: "Ambre", cadreDe: "#ef6c00", cadreVers: "#ffb300", accent: "#e65100" },
  olive: { nom: "Olive", cadreDe: "#558b2f", cadreVers: "#9ccc65", accent: "#33691e" },
  prune: { nom: "Prune", cadreDe: "#6a1b9a", cadreVers: "#ab47bc", accent: "#4a148c" },
};

export const NOMS_THEMES = Object.entries(THEMES).map(([cle, t]) => ({
  valeur: cle as ThemeT,
  nom: t.nom,
}));
