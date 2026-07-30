import { z } from "zod";
import { LIMITES, type PostVisuelT } from "@/lib/templates/social/schema";
import { THEME_IDS, type ThemeT } from "@/lib/templates/social/themes";
import { LIMITES_TEXTE, type CompositionT } from "@/lib/composition/schema";

// Schémas des FORMULAIRES du flux de validation, en deux étapes indépendantes :
//   • FaitsForm   (étape 2) — ce que l'IA a extrait, corrigé par l'humain
//   • VisuelForm  (étape 3) — le texte du post, la photo et l'habillage
// Ils ne remplacent pas les schémas d'extraction : c'est la forme éditable, en
// chaînes de caractères (ce que rendent les <input>), avec les mêmes limites que
// le gabarit. Ils servent au client (react-hook-form) ET au serveur, qui revalide
// toujours — le navigateur peut mentir et une erreur de prix a un coût réel.
//
// Conventions : un champ texte vide vaut « absent » et devient NULL en colonne ;
// les listes s'éditent une entrée par ligne dans un <textarea>.

const RE_DATE = /^(\d{4}-\d{2}-\d{2})?$/;
const dateOuVide = z.string().regex(RE_DATE, "format attendu : AAAA-MM-JJ");
const entierOuVide = z
  .string()
  .regex(/^\d*$/, "nombre entier attendu")
  .refine((v) => v === "" || Number(v) > 0, "doit être supérieur à 0");
const montantOuVide = z
  .string()
  .regex(/^(\d+([.,]\d{1,2})?)?$/, "montant attendu, ex. 2249 ou 2249,50")
  .refine((v) => v === "" || Number(v.replace(",", ".")) > 0, "doit être supérieur à 0");

// ── Étape 2 : les faits ────────────────────────────────────────────────────
export const FaitsForm = z
  .object({
    theme_voyage: z.string(),
    type_produit: z.enum(["", "forfait", "croisiere", "circuit"]),
    fournisseur: z.string(),
    destination_pays: z.string(),
    destination_ville: z.string(),
    date_depart: dateOuVide,
    date_retour: dateOuVide,
    duree_nuits: entierOuVide,
    duree_jours: entierOuVide,
    prix_par_personne: z
      .string()
      .min(1, "le prix est obligatoire")
      .regex(/^\d+([.,]\d{1,2})?$/, "montant attendu, ex. 2599 ou 2599,50")
      .refine((v) => Number(v.replace(",", ".")) > 0, "doit être supérieur à 0"),
    // Détail du prix, tel que le document le sépare. N'apparaît sur aucune sortie :
    // le visuel n'affiche que prix_par_personne, toujours taxes incluses.
    prix_base: montantOuVide,
    taxes: montantOuVide,
    devise: z.string(),
    occupation: z.enum(["", "simple", "double", "triple", "quadruple"]),
    taxes_incluses: z.enum(["", "oui", "non"]),
    prix_valide_jusqua: dateOuVide,
    compagnie_aerienne: z.string(),
    aeroport_depart: z.string(),
    aeroports_alternatifs: z.string(), // séparés par des virgules
    etablissement_nom: z.string(),
    etablissement_type: z.enum(["", "hotel", "navire", "multiple"]),
    etablissement_categorie: z.string(),
    type_cabine: z.string(),
    lien_reservation: z.string(),
    lien_tripadvisor: z.string(),
    lien_monarc: z.string(),
    inclusions: z.string(), // une par ligne
    exclusions: z.string(),
    itineraire: z.string(), // une étape par ligne
  })
  .refine((d) => !(d.date_depart && d.date_retour) || d.date_retour >= d.date_depart, {
    message: "le retour précède le départ",
    path: ["date_retour"],
  });

export type FaitsFormT = z.infer<typeof FaitsForm>;

// ── Étape 3 : le visuel ────────────────────────────────────────────────────
export const VisuelForm = z
  .object({
    titre: z.string().min(1, "titre obligatoire").max(LIMITES.titre),
    bandeau: z.string().max(LIMITES.bandeau),
    colonnes: z
      .array(
        z.object({
          entete: z.string().max(LIMITES.entete),
          // Un bloc = 1 ou 2 lignes du visuel, éditées comme deux lignes de texte.
          blocs: z.array(z.object({ texte: z.string() })).min(1).max(LIMITES.blocs),
          surtitre: z.string().max(LIMITES.surtitre),
          montant: z.string().regex(/^\d+$/, "montant entier attendu"),
          mentions: z.string(), // une mention par ligne
        }),
      )
      .min(1)
      .max(LIMITES.colonnes),
    prix_secondaire_actif: z.boolean(),
    prix_secondaire: z.object({
      surtitre: z.string().max(LIMITES.surtitre),
      montant: z.string(),
      mentions: z.string(),
    }),
    badge_actif: z.boolean(),
    badge: z.object({ texte: z.string().max(LIMITES.badge), icone: z.string() }),
    accroche: z.string().max(LIMITES_TEXTE.accroche),
    faq: z.array(
      z.object({
        q: z.string().min(1, "question obligatoire").max(LIMITES_TEXTE.question),
        r: z.string().min(1, "réponse obligatoire").max(LIMITES_TEXTE.reponse),
      }),
    ),
    // Dérivé de themes.ts : ajouter un frame suffit à l'accepter au formulaire.
    theme: z.enum(THEME_IDS),
    focale: z.enum(["haut", "centre", "bas"]),
  })
  .superRefine((v, ctx) => {
    v.colonnes.forEach((col, i) => {
      col.blocs.forEach((b, j) => {
        const lignes = decouper(b.texte);
        if (lignes.length < 1 || lignes.length > LIMITES.lignes)
          ctx.addIssue({
            code: "custom",
            path: ["colonnes", i, "blocs", j, "texte"],
            message: `${lignes.length} ligne(s) : un bloc en compte 1 ou ${LIMITES.lignes}`,
          });
        lignes.forEach((l) => {
          if (l.length > LIMITES.ligne)
            ctx.addIssue({
              code: "custom",
              path: ["colonnes", i, "blocs", j, "texte"],
              message: `ligne de ${l.length} caractères, maximum ${LIMITES.ligne}`,
            });
        });
      });
      const mentions = decouper(col.mentions);
      if (mentions.length > LIMITES.mentions)
        ctx.addIssue({
          code: "custom",
          path: ["colonnes", i, "mentions"],
          message: `${mentions.length} mentions, maximum ${LIMITES.mentions}`,
        });
      mentions.forEach((m) => {
        if (m.length > LIMITES.mention)
          ctx.addIssue({
            code: "custom",
            path: ["colonnes", i, "mentions"],
            message: `« ${m} » fait ${m.length} caractères, maximum ${LIMITES.mention}`,
          });
      });
    });

    if (v.prix_secondaire_actif && !/^\d+$/.test(v.prix_secondaire.montant))
      ctx.addIssue({
        code: "custom",
        path: ["prix_secondaire", "montant"],
        message: "montant entier attendu",
      });
    if (v.badge_actif && v.badge.texte.trim() === "")
      ctx.addIssue({
        code: "custom",
        path: ["badge", "texte"],
        message: "texte du badge obligatoire",
      });
  });

export type VisuelFormT = z.infer<typeof VisuelForm>;

// ── Conversions ────────────────────────────────────────────────────────────

export function decouper(texte: string): string[] {
  return texte
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l !== "");
}

const joindre = (v: unknown): string =>
  Array.isArray(v) ? v.map((x) => String(x)).join("\n") : "";
const chaine = (v: unknown): string => (v == null ? "" : String(v));
const nombre = (v: unknown): string => (v == null ? "" : String(v));

// Colonnes de l'offre + faits sans colonne → valeurs de l'étape 2.
export function offreVersFaitsForm(
  offre: Record<string, unknown>,
  extraction: Record<string, unknown>,
  contenusFr: Record<string, unknown> | null,
): FaitsFormT {
  const itineraire = Array.isArray(contenusFr?.itineraire)
    ? (contenusFr.itineraire as Array<Record<string, unknown>>)
        .map((e) => chaine(e.titre))
        .join("\n")
    : Array.isArray(extraction.itineraire)
      ? (extraction.itineraire as Array<Record<string, unknown>>)
          .map((e) => chaine(e.lieu) + (e.pays ? ` (${chaine(e.pays)})` : ""))
          .join("\n")
      : "";

  return {
    theme_voyage: chaine(extraction.theme_voyage),
    type_produit: (chaine(offre.type_produit) || "") as FaitsFormT["type_produit"],
    fournisseur: chaine(offre.fournisseur),
    destination_pays: chaine(offre.destination_pays),
    destination_ville: chaine(offre.destination_ville),
    date_depart: chaine(offre.date_depart),
    date_retour: chaine(offre.date_retour),
    duree_nuits: nombre(offre.duree_nuits),
    duree_jours: nombre(offre.duree_jours),
    prix_par_personne: nombre(offre.prix_par_personne),
    prix_base: nombre(offre.prix_base),
    taxes: nombre(offre.taxes),
    devise: chaine(offre.devise),
    occupation: (chaine(offre.occupation) || "") as FaitsFormT["occupation"],
    taxes_incluses: offre.taxes_incluses == null ? "" : offre.taxes_incluses ? "oui" : "non",
    prix_valide_jusqua: chaine(offre.prix_valide_jusqua),
    compagnie_aerienne: chaine(offre.compagnie_aerienne),
    aeroport_depart: chaine(offre.aeroport_depart),
    aeroports_alternatifs: Array.isArray(offre.aeroports_alternatifs)
      ? (offre.aeroports_alternatifs as string[]).join(", ")
      : "",
    etablissement_nom: chaine(offre.etablissement_nom),
    etablissement_type: (chaine(offre.etablissement_type) || "") as FaitsFormT["etablissement_type"],
    etablissement_categorie: chaine(offre.etablissement_categorie),
    type_cabine: chaine(offre.type_cabine),
    lien_reservation: chaine(offre.lien_reservation),
    lien_tripadvisor: chaine(offre.lien_tripadvisor),
    lien_monarc: chaine(offre.lien_monarc),
    inclusions: joindre(contenusFr?.inclusions ?? extraction.inclusions),
    exclusions: joindre(contenusFr?.exclusions ?? extraction.exclusions),
    itineraire,
  };
}

// Composition (Appel 2) ou contenus.fr déjà édité → valeurs de l'étape 3.
export function compositionVersVisuelForm(
  composition: Partial<CompositionT> | null,
  visuel: PostVisuelT | null,
  prixParDefaut: string,
): VisuelFormT {
  const colonnes =
    composition?.colonnes?.map((c) => ({
      entete: c.entete ?? "",
      blocs: (c.blocs ?? []).map((b) => ({ texte: (b.lignes ?? []).join("\n") })),
      surtitre: c.prix?.surtitre ?? "À partir de seulement",
      montant: nombre(c.prix?.montant),
      mentions: (c.prix?.mentions ?? []).join("\n"),
    })) ?? [];

  return {
    titre: composition?.titre ?? "",
    bandeau: composition?.bandeau ?? "",
    colonnes: colonnes.length
      ? colonnes
      : [
          {
            entete: "",
            blocs: [{ texte: "" }],
            surtitre: "À partir de seulement",
            montant: prixParDefaut,
            mentions: "",
          },
        ],
    prix_secondaire_actif: composition?.prix_secondaire != null,
    prix_secondaire: {
      surtitre: composition?.prix_secondaire?.surtitre ?? "",
      montant: nombre(composition?.prix_secondaire?.montant),
      mentions: (composition?.prix_secondaire?.mentions ?? []).join("\n"),
    },
    badge_actif: composition?.badge != null,
    badge: { texte: composition?.badge?.texte ?? "", icone: composition?.badge?.icone ?? "" },
    accroche: composition?.accroche ?? "",
    faq: (composition?.faq as Array<{ q: string; r: string }> | undefined) ?? [],
    theme: (visuel?.theme ?? "azur") as ThemeT,
    focale: visuel?.photo?.focale ?? "centre",
  };
}

// Étape 2 → colonnes de la table offres. Un champ vide devient NULL.
export function faitsFormVersColonnes(d: FaitsFormT): Record<string, unknown> {
  const vide = (s: string) => (s.trim() === "" ? null : s.trim());
  const entier = (s: string) => (s.trim() === "" ? null : Number(s));
  const montant = (s: string) => (s.trim() === "" ? null : Number(s.replace(",", ".")));
  const alternatifs = d.aeroports_alternatifs
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    type_produit: vide(d.type_produit),
    fournisseur: vide(d.fournisseur),
    destination_pays: vide(d.destination_pays),
    destination_ville: vide(d.destination_ville),
    date_depart: vide(d.date_depart),
    date_retour: vide(d.date_retour),
    duree_nuits: entier(d.duree_nuits),
    duree_jours: entier(d.duree_jours),
    prix_par_personne: Number(d.prix_par_personne.replace(",", ".")),
    prix_base: montant(d.prix_base),
    taxes: montant(d.taxes),
    devise: vide(d.devise),
    occupation: vide(d.occupation),
    taxes_incluses: d.taxes_incluses === "" ? null : d.taxes_incluses === "oui",
    prix_valide_jusqua: vide(d.prix_valide_jusqua),
    compagnie_aerienne: vide(d.compagnie_aerienne),
    aeroport_depart: vide(d.aeroport_depart),
    aeroports_alternatifs: alternatifs.length ? alternatifs : null,
    etablissement_nom: vide(d.etablissement_nom),
    etablissement_type: vide(d.etablissement_type),
    etablissement_categorie: vide(d.etablissement_categorie),
    type_cabine: vide(d.type_cabine),
    lien_reservation: vide(d.lien_reservation),
    lien_tripadvisor: vide(d.lien_tripadvisor),
    lien_monarc: vide(d.lien_monarc),
  };
}

// Étape 2 → part de contenus.fr qui lui appartient (listes factuelles).
export function faitsFormVersContenus(d: FaitsFormT): Record<string, unknown> {
  return {
    inclusions: decouper(d.inclusions),
    exclusions: decouper(d.exclusions),
    // Le texte détaillé de chaque étape appartient à la landing page (phase 6).
    itineraire: decouper(d.itineraire).map((titre, i) => ({ jour: i + 1, titre, texte: "" })),
  };
}

// Étape 3 → PostVisuel : le texte rejoint la photo hero et l'habillage choisi.
export function visuelFormVersPostVisuel(v: VisuelFormT, heroUrl: string): PostVisuelT {
  // `|| 0` : sert aussi à l'aperçu en direct, où le montant est transitoirement
  // vide pendant la saisie. L'action, elle, a déjà revalidé.
  const prix = (surtitre: string, montant: string, mentions: string) => ({
    surtitre,
    montant: Number(montant) || 0,
    mentions: decouper(mentions),
  });
  return {
    variante: v.colonnes.length === 2 ? "double" : "simple",
    theme: v.theme,
    photo: { url: heroUrl, focale: v.focale },
    titre: v.titre,
    bandeau: v.bandeau,
    colonnes: v.colonnes.map((c) => ({
      entete: c.entete.trim() === "" ? null : c.entete,
      blocs: c.blocs.map((b) => ({ lignes: decouper(b.texte) })),
      prix: prix(c.surtitre, c.montant, c.mentions),
    })),
    prix_secondaire: v.prix_secondaire_actif
      ? prix(v.prix_secondaire.surtitre, v.prix_secondaire.montant, v.prix_secondaire.mentions)
      : null,
    badge: v.badge_actif ? { texte: v.badge.texte, icone: v.badge.icone } : null,
  };
}

// Étape 3 → part de contenus.fr qui lui appartient.
export function visuelFormVersContenus(
  v: VisuelFormT,
  heroUrl: string,
): Record<string, unknown> {
  return {
    titre: v.titre,
    accroche: v.accroche,
    faq: v.faq,
    visuel: visuelFormVersPostVisuel(v, heroUrl),
  };
}

// contenus.fr (version éditée par l'humain) relu comme une composition, pour que
// l'étape 3 reparte de ce que l'opérateur a écrit et non de la sortie de l'IA.
export function contenusVersComposition(
  contenusFr: Record<string, unknown>,
): CompositionT | null {
  const v = contenusFr.visuel as Record<string, unknown> | undefined;
  if (!v) return null;
  const colonnes = (v.colonnes as Array<Record<string, unknown>>) ?? [];
  return {
    titre: (v.titre as string) ?? "",
    bandeau: (v.bandeau as string) ?? "",
    colonnes: colonnes.map((c) => ({
      entete: (c.entete as string | null) ?? "",
      blocs: ((c.blocs as Array<{ lignes: string[] }>) ?? []).map((b) => ({
        lignes: b.lignes ?? [],
      })),
      prix: c.prix as { surtitre: string; montant: number; mentions: string[] },
    })),
    prix_secondaire:
      (v.prix_secondaire as { surtitre: string; montant: number; mentions: string[] } | null) ??
      undefined,
    badge: (v.badge as { texte: string; icone: string } | null) ?? undefined,
    accroche: (contenusFr.accroche as string) ?? "",
    faq: (contenusFr.faq as Array<{ q: string; r: string }>) ?? [],
  };
}

// Slug depuis le titre validé : translittéré, minuscules, tirets. Le suffixe
// anti-collision est ajouté par l'action (elle seule voit la base).
export function slugifier(titre: string): string {
  const base = titre
    .normalize("NFD") // décompose « é » en « e » + accent combinant
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return base || "offre";
}
