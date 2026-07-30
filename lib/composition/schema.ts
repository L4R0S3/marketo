import { z } from "zod";
import {
  LIMITES,
  type FocaleT,
  type PostVisuelT,
  type ThemeT,
} from "@/lib/templates/social/schema";

// Sortie de l'APPEL 2 — le TEXTE, et rien d'autre. Ni photo.url (le modèle ne
// connaît pas la photo hero), ni theme (décision de marque) : ils sont injectés
// côté app par assemblerPostVisuel(). La variante simple/double se DÉDUIT du
// nombre de colonnes, elle n'est pas demandée au modèle.
//
// Deux schémas, volontairement :
//   • CompositionForme     → envoyée à l'API (structure seule). Les structured
//     outputs ne portent PAS les longueurs : les SDK retirent minLength/maxLength.
//   • CompositionSociale   → CompositionForme + toutes les longueurs, vérifiée
//     côté client. C'est son message d'erreur qui alimente l'UNIQUE relance.
// Une seule définition de structure, une seule table de limites : pas de dérive.
//
// Sentinelles, comme à l'Appel 1 (cf. lib/schema/offre.ts) : entete = "" quand la
// colonne n'a pas d'en-tête ; prix_secondaire et badge sont des objets, donc omis.

const PrixForme = z.object({
  surtitre: z.string(),
  montant: z.number().int().positive(),
  mentions: z.array(z.string()),
});

const BlocForme = z.object({
  lignes: z.array(z.string()),
});

const ColonneForme = z.object({
  entete: z.string(), // "" = pas d'en-tête (variante simple)
  blocs: z.array(BlocForme),
  prix: PrixForme,
});

export const CompositionForme = z.object({
  titre: z.string(),
  bandeau: z.string(),
  colonnes: z.array(ColonneForme),
  prix_secondaire: PrixForme.optional(), // omis s'il n'y a pas de supplément à afficher
  badge: z.object({ texte: z.string(), icone: z.string() }).optional(),
  accroche: z.string(),
  faq: z.array(z.object({ q: z.string(), r: z.string() })),
});

export type CompositionT = z.infer<typeof CompositionForme>;

// Limites propres aux textes longs (hors gabarit social : ils alimentent la
// landing page). Valeurs de départ, à ajuster librement — elles ne sont
// contraintes par aucun rendu à largeur fixe.
export const LIMITES_TEXTE = { accroche: 300, faqMin: 3, faqMax: 6, question: 90, reponse: 400 } as const;

// CompositionForme + longueurs. Les messages sont rédigés pour être renvoyés
// TELS QUELS au modèle lors de la relance : ils disent quoi raccourcir et de combien.
export const CompositionSociale = CompositionForme.superRefine((c, ctx) => {
  const trop = (chemin: (string | number)[], valeur: string, max: number, quoi: string) => {
    if (valeur.length > max)
      ctx.addIssue({
        code: "custom",
        path: chemin,
        message: `${quoi} fait ${valeur.length} caractères, maximum ${max} — raccourcis de ${valeur.length - max}`,
      });
  };
  const verifierPrix = (p: CompositionT["prix_secondaire"], chemin: (string | number)[]) => {
    if (!p) return;
    trop([...chemin, "surtitre"], p.surtitre, LIMITES.surtitre, "le surtitre du prix");
    if (p.mentions.length > LIMITES.mentions)
      ctx.addIssue({
        code: "custom",
        path: [...chemin, "mentions"],
        message: `${p.mentions.length} mentions, maximum ${LIMITES.mentions}`,
      });
    p.mentions.forEach((m, i) =>
      trop([...chemin, "mentions", i], m, LIMITES.mention, "la mention"),
    );
  };

  trop(["titre"], c.titre, LIMITES.titre, "le titre");
  trop(["bandeau"], c.bandeau, LIMITES.bandeau, "le bandeau");

  if (c.colonnes.length < 1 || c.colonnes.length > LIMITES.colonnes)
    ctx.addIssue({
      code: "custom",
      path: ["colonnes"],
      message: `${c.colonnes.length} colonnes, attendu 1 (offre simple) ou ${LIMITES.colonnes} (comparaison de deux formules)`,
    });

  c.colonnes.forEach((col, i) => {
    trop(["colonnes", i, "entete"], col.entete, LIMITES.entete, "l'en-tête de colonne");
    if (col.blocs.length < 1 || col.blocs.length > LIMITES.blocs)
      ctx.addIssue({
        code: "custom",
        path: ["colonnes", i, "blocs"],
        message: `${col.blocs.length} blocs, attendu entre 1 et ${LIMITES.blocs}`,
      });
    col.blocs.forEach((b, j) => {
      if (b.lignes.length < 1 || b.lignes.length > LIMITES.lignes)
        ctx.addIssue({
          code: "custom",
          path: ["colonnes", i, "blocs", j, "lignes"],
          message: `${b.lignes.length} lignes, attendu 1 ou ${LIMITES.lignes} — un bloc ne dépasse jamais deux lignes`,
        });
      b.lignes.forEach((l, k) =>
        trop(["colonnes", i, "blocs", j, "lignes", k], l, LIMITES.ligne, "la ligne"),
      );
    });
    verifierPrix(col.prix, ["colonnes", i, "prix"]);
  });

  verifierPrix(c.prix_secondaire, ["prix_secondaire"]);
  if (c.badge) trop(["badge", "texte"], c.badge.texte, LIMITES.badge, "le texte du badge");

  trop(["accroche"], c.accroche, LIMITES_TEXTE.accroche, "l'accroche");
  if (c.faq.length < LIMITES_TEXTE.faqMin || c.faq.length > LIMITES_TEXTE.faqMax)
    ctx.addIssue({
      code: "custom",
      path: ["faq"],
      message: `${c.faq.length} entrées de FAQ, attendu entre ${LIMITES_TEXTE.faqMin} et ${LIMITES_TEXTE.faqMax}`,
    });
  c.faq.forEach((e, i) => {
    trop(["faq", i, "q"], e.q, LIMITES_TEXTE.question, "la question");
    trop(["faq", i, "r"], e.r, LIMITES_TEXTE.reponse, "la réponse");
  });
});

// Assemblage du PostVisuel : le texte du modèle + ce que lui seul ne peut pas
// savoir. La variante se déduit du nombre de colonnes ; les sentinelles ""/omis
// deviennent les null attendus par le gabarit.
export function assemblerPostVisuel(
  composition: CompositionT,
  habillage: { heroUrl: string; theme: ThemeT; focale?: FocaleT },
): PostVisuelT {
  return {
    variante: composition.colonnes.length === 2 ? "double" : "simple",
    theme: habillage.theme,
    photo: { url: habillage.heroUrl, focale: habillage.focale ?? "centre" },
    titre: composition.titre,
    bandeau: composition.bandeau,
    colonnes: composition.colonnes.map((c) => ({
      entete: c.entete === "" ? null : c.entete,
      blocs: c.blocs,
      prix: c.prix,
    })),
    prix_secondaire: composition.prix_secondaire ?? null,
    badge: composition.badge ?? null,
  };
}
