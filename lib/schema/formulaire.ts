import { z } from "zod";
import { LIMITES, type PostVisuelT, type ThemeT } from "@/lib/templates/social/schema";
import { LIMITES_TEXTE, type CompositionT } from "@/lib/composition/schema";

// Schéma du FORMULAIRE DE VALIDATION (phase 3). Il ne remplace pas les schémas
// d'extraction : c'est la forme éditable par l'humain, en chaînes de caractères
// (ce que rendent les <input>), avec les mêmes limites de longueur que le gabarit.
// Il sert au client (react-hook-form + zodResolver) ET au serveur (l'action
// revalide, elle ne fait jamais confiance au navigateur).
//
// Conventions : un champ texte vide vaut « absent » et devient NULL en colonne ;
// les listes s'éditent une entrée par ligne dans un <textarea>.

const RE_DATE = /^(\d{4}-\d{2}-\d{2})?$/;
const dateOuVide = z.string().regex(RE_DATE, "format attendu : AAAA-MM-JJ");
const entierOuVide = z
  .string()
  .regex(/^\d*$/, "nombre entier attendu")
  .refine((v) => v === "" || Number(v) > 0, "doit être supérieur à 0");

export const FormulaireOffre = z.object({
  faits: z.object({
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
  }),
  texte: z.object({
    titre: z.string().min(1, "titre obligatoire").max(LIMITES.titre),
    bandeau: z.string().max(LIMITES.bandeau),
    colonnes: z
      .array(
        z.object({
          entete: z.string().max(LIMITES.entete),
          // Un bloc = 1 ou 2 lignes, éditées comme deux lignes d'un textarea.
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
  }),
  habillage: z.object({
    theme: z.enum(["framboise", "sarcelle", "azur", "ambre", "olive", "prune"]),
    focale: z.enum(["haut", "centre", "bas"]),
  }),
})
  .superRefine((f, ctx) => {
    // Cohérences que les champs isolés ne peuvent pas voir.
    const d = f.faits;
    if (d.date_depart && d.date_retour && d.date_retour < d.date_depart)
      ctx.addIssue({
        code: "custom",
        path: ["faits", "date_retour"],
        message: "le retour précède le départ",
      });

    f.texte.colonnes.forEach((col, i) => {
      col.blocs.forEach((b, j) => {
        const lignes = decouper(b.texte);
        if (lignes.length < 1 || lignes.length > LIMITES.lignes)
          ctx.addIssue({
            code: "custom",
            path: ["texte", "colonnes", i, "blocs", j, "texte"],
            message: `${lignes.length} ligne(s) : un bloc en compte 1 ou ${LIMITES.lignes}`,
          });
        lignes.forEach((l) => {
          if (l.length > LIMITES.ligne)
            ctx.addIssue({
              code: "custom",
              path: ["texte", "colonnes", i, "blocs", j, "texte"],
              message: `ligne de ${l.length} caractères, maximum ${LIMITES.ligne}`,
            });
        });
      });
      const mentions = decouper(col.mentions);
      if (mentions.length > LIMITES.mentions)
        ctx.addIssue({
          code: "custom",
          path: ["texte", "colonnes", i, "mentions"],
          message: `${mentions.length} mentions, maximum ${LIMITES.mentions}`,
        });
      mentions.forEach((m) => {
        if (m.length > LIMITES.mention)
          ctx.addIssue({
            code: "custom",
            path: ["texte", "colonnes", i, "mentions"],
            message: `« ${m} » fait ${m.length} caractères, maximum ${LIMITES.mention}`,
          });
      });
    });

    if (f.texte.prix_secondaire_actif && !/^\d+$/.test(f.texte.prix_secondaire.montant))
      ctx.addIssue({
        code: "custom",
        path: ["texte", "prix_secondaire", "montant"],
        message: "montant entier attendu",
      });
    if (f.texte.badge_actif && f.texte.badge.texte.trim() === "")
      ctx.addIssue({
        code: "custom",
        path: ["texte", "badge", "texte"],
        message: "texte du badge obligatoire",
      });
  });

export type FormulaireOffreT = z.infer<typeof FormulaireOffre>;

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

// Faits + composition (sortie de l'Appel 2) → valeurs par défaut du formulaire.
export function offreVersFormulaire(
  offre: Record<string, unknown>,
  extraction: Record<string, unknown>,
  composition: Partial<CompositionT> | null,
  contenusFr: Record<string, unknown> | null,
): FormulaireOffreT {
  const visuel = (contenusFr?.visuel ?? null) as PostVisuelT | null;
  const source = composition ?? null;

  const colonnes =
    source?.colonnes?.map((c) => ({
      entete: c.entete ?? "",
      blocs: (c.blocs ?? []).map((b) => ({ texte: (b.lignes ?? []).join("\n") })),
      surtitre: c.prix?.surtitre ?? "À partir de seulement",
      montant: nombre(c.prix?.montant),
      mentions: (c.prix?.mentions ?? []).join("\n"),
    })) ?? [];

  const itineraire = Array.isArray(extraction.itineraire)
    ? (extraction.itineraire as Array<Record<string, unknown>>)
        .map((e) => chaine(e.lieu) + (e.pays ? ` (${chaine(e.pays)})` : ""))
        .join("\n")
    : "";

  return {
    faits: {
      theme_voyage: chaine(extraction.theme_voyage),
      type_produit: (chaine(offre.type_produit) || "") as "" | "forfait" | "croisiere" | "circuit",
      fournisseur: chaine(offre.fournisseur),
      destination_pays: chaine(offre.destination_pays),
      destination_ville: chaine(offre.destination_ville),
      date_depart: chaine(offre.date_depart),
      date_retour: chaine(offre.date_retour),
      duree_nuits: nombre(offre.duree_nuits),
      duree_jours: nombre(offre.duree_jours),
      prix_par_personne: nombre(offre.prix_par_personne),
      devise: chaine(offre.devise),
      occupation: (chaine(offre.occupation) || "") as "" | "simple" | "double" | "triple" | "quadruple",
      taxes_incluses: offre.taxes_incluses == null ? "" : offre.taxes_incluses ? "oui" : "non",
      prix_valide_jusqua: chaine(offre.prix_valide_jusqua),
      compagnie_aerienne: chaine(offre.compagnie_aerienne),
      aeroport_depart: chaine(offre.aeroport_depart),
      aeroports_alternatifs: Array.isArray(offre.aeroports_alternatifs)
        ? (offre.aeroports_alternatifs as string[]).join(", ")
        : "",
      etablissement_nom: chaine(offre.etablissement_nom),
      etablissement_type: (chaine(offre.etablissement_type) || "") as "" | "hotel" | "navire" | "multiple",
      etablissement_categorie: chaine(offre.etablissement_categorie),
      type_cabine: chaine(offre.type_cabine),
      lien_reservation: chaine(offre.lien_reservation),
      lien_tripadvisor: chaine(offre.lien_tripadvisor),
      lien_monarc: chaine(offre.lien_monarc),
      inclusions: joindre(contenusFr?.inclusions ?? extraction.inclusions),
      exclusions: joindre(contenusFr?.exclusions ?? extraction.exclusions),
      itineraire,
    },
    texte: {
      titre: source?.titre ?? chaine(contenusFr?.titre),
      bandeau: source?.bandeau ?? "",
      colonnes: colonnes.length
        ? colonnes
        : [
            {
              entete: "",
              blocs: [{ texte: "" }],
              surtitre: "À partir de seulement",
              montant: nombre(offre.prix_par_personne),
              mentions: "",
            },
          ],
      prix_secondaire_actif: source?.prix_secondaire != null,
      prix_secondaire: {
        surtitre: source?.prix_secondaire?.surtitre ?? "",
        montant: nombre(source?.prix_secondaire?.montant),
        mentions: (source?.prix_secondaire?.mentions ?? []).join("\n"),
      },
      badge_actif: source?.badge != null,
      badge: { texte: source?.badge?.texte ?? "", icone: source?.badge?.icone ?? "" },
      accroche: source?.accroche ?? chaine(contenusFr?.accroche),
      faq: (source?.faq as Array<{ q: string; r: string }> | undefined) ?? [],
    },
    habillage: {
      theme: (visuel?.theme ?? "azur") as ThemeT,
      focale: visuel?.photo?.focale ?? "centre",
    },
  };
}

// Formulaire → colonnes de la table offres. Un champ vide devient NULL.
export function formulaireVersColonnes(f: FormulaireOffreT): Record<string, unknown> {
  const d = f.faits;
  const vide = (s: string) => (s.trim() === "" ? null : s.trim());
  const entier = (s: string) => (s.trim() === "" ? null : Number(s));
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

// Formulaire → PostVisuel (le gabarit) : c'est ici que la photo hero et le thème
// choisi par l'opérateur rejoignent le texte.
export function formulaireVersVisuel(
  f: FormulaireOffreT,
  heroUrl: string,
): PostVisuelT {
  // `|| 0` : la fonction sert aussi à l'aperçu en direct, où le champ montant est
  // transitoirement vide pendant la saisie. L'action, elle, a déjà revalidé.
  const prix = (surtitre: string, montant: string, mentions: string) => ({
    surtitre,
    montant: Number(montant) || 0,
    mentions: decouper(mentions),
  });
  return {
    variante: f.texte.colonnes.length === 2 ? "double" : "simple",
    theme: f.habillage.theme,
    photo: { url: heroUrl, focale: f.habillage.focale },
    titre: f.texte.titre,
    bandeau: f.texte.bandeau,
    colonnes: f.texte.colonnes.map((c) => ({
      entete: c.entete.trim() === "" ? null : c.entete,
      blocs: c.blocs.map((b) => ({ lignes: decouper(b.texte) })),
      prix: prix(c.surtitre, c.montant, c.mentions),
    })),
    prix_secondaire: f.texte.prix_secondaire_actif
      ? prix(
          f.texte.prix_secondaire.surtitre,
          f.texte.prix_secondaire.montant,
          f.texte.prix_secondaire.mentions,
        )
      : null,
    badge: f.texte.badge_actif
      ? { texte: f.texte.badge.texte, icone: f.texte.badge.icone }
      : null,
  };
}

// Formulaire → contenus.fr (JSONB localisé, CLAUDE.md §5). La version éditée par
// l'humain vit ici ; extraction_brute garde la sortie de l'IA, intacte.
export function formulaireVersContenus(
  f: FormulaireOffreT,
  heroUrl: string,
): Record<string, unknown> {
  return {
    titre: f.texte.titre,
    accroche: f.texte.accroche,
    inclusions: decouper(f.faits.inclusions),
    exclusions: decouper(f.faits.exclusions),
    // L'étape est éditée en une ligne ; le texte détaillé de chaque étape
    // appartient à la landing page (phase 6), il reste vide ici.
    itineraire: decouper(f.faits.itineraire).map((titre, i) => ({
      jour: i + 1,
      titre,
      texte: "",
    })),
    faq: f.texte.faq,
    visuel: formulaireVersVisuel(f, heroUrl),
  };
}

// Slug depuis le titre validé : translittéré, minuscules, tirets. Le suffixe
// anti-collision est ajouté par l'action (elle seule voit la base).
export function slugifier(titre: string): string {
  const base = titre
    .normalize("NFD") // décompose « é » en « e » + accent combinant
    .replace(/[̀-ͯ]/g, "") // diacritiques combinantes
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return base || "offre";
}
