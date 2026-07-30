import { z } from "zod";
import { THEME_IDS } from "./themes";

// Gabarit du post social 1080×1350 (spec CLAUDE.md §6). Ce schéma est le type
// de RENDU, côté app : il n'est jamais envoyé à l'API. Il est assemblé à partir
// de la sortie de l'Appel 2 (le texte) + la photo hero + le thème choisi par
// l'opérateur — cf. lib/composition/schema.ts.

// Limites de longueur du gabarit. Source unique : elles servent au schéma de
// rendu, à la validation de l'Appel 2 et au prompt de l'Appel 2.
// NOTE (CLAUDE.md §13) : la limite de ligne est une estimation à ré-étalonner en
// phase 4, après mesure du rendu réel avec la police définitive.
export const LIMITES = {
  titre: 34,
  bandeau: 58,
  entete: 62,
  ligne: 62,
  surtitre: 24,
  mention: 22,
  mentions: 3,
  badge: 30,
  blocs: 4,
  colonnes: 2,
  lignes: 2,
} as const;

export const Prix = z.object({
  surtitre: z.string().max(LIMITES.surtitre).default("À partir de seulement"),
  montant: z.number().int().positive(),
  mentions: z.array(z.string().max(LIMITES.mention)).max(LIMITES.mentions),
});

// Les pastilles blanches épousent la largeur de CHAQUE ligne (box-decoration-break
// non supporté par Satori) : les lignes sont donc stockées séparément. Ne remplace
// pas ce tableau par une chaîne.
export const Bloc = z.object({
  lignes: z.array(z.string().max(LIMITES.ligne)).min(1).max(LIMITES.lignes),
});

export const Colonne = z.object({
  entete: z.string().max(LIMITES.entete).nullable(),
  blocs: z.array(Bloc).min(1).max(LIMITES.blocs),
  prix: Prix,
});

export const PostVisuel = z.object({
  variante: z.enum(["simple", "double"]),
  // Les thèmes viennent de themes.ts : ajouter un frame suffit à l'accepter ici.
  theme: z.enum(THEME_IDS),
  photo: z.object({
    url: z.string().url(),
    focale: z.enum(["haut", "centre", "bas"]).default("centre"),
  }),
  titre: z.string().max(LIMITES.titre),
  bandeau: z.string().max(LIMITES.bandeau),
  colonnes: z.array(Colonne).min(1).max(LIMITES.colonnes),
  prix_secondaire: Prix.nullable(),
  badge: z.object({ texte: z.string().max(LIMITES.badge), icone: z.string() }).nullable(),
});

export type PostVisuelT = z.infer<typeof PostVisuel>;
export type FocaleT = PostVisuelT["photo"]["focale"];
export type { ThemeT } from "./themes";
