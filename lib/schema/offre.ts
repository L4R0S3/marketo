import { z } from "zod";

// Source de vérité des FAITS extraits (Appel 1). Aucun texte composé, aucune
// contrainte de longueur — uniquement des faits. La cohérence métier (dates,
// prix > 0) est vérifiée côté client par les refine ; les structured outputs
// ne portent que la forme.

// Date ISO (YYYY-MM-DD). Les chaînes ISO se comparent lexicographiquement.
const DateISO = z.iso.date();

const Occupation = z.enum(["simple", "double", "triple", "quadruple"]);
const TypeProduit = z.enum(["forfait", "croisiere", "circuit"]);
const TypeEtablissement = z.enum(["hotel", "navire", "multiple"]);

// Une « formule » = navire/hôtel + catégorie + type de cabine + dates + prix.
// La formule PRINCIPALE est aplatie au niveau racine (mappe 1:1 aux colonnes de
// la table offres). Une formule_secondaire non nulle = variante « double »
// (comparaison de deux navires/dates, ex. post MSC SOLO).
const Formule = z.object({
  etablissement_nom: z.string().nullable(), // navire ou hôtel
  etablissement_type: TypeEtablissement.nullable(),
  etablissement_categorie: z.string().nullable(), // VRAIE catégorie : étoiles d'hôtel, classe de navire
  type_cabine: z.string().nullable(), // "Cabine balcon", "Studio solo intérieur", "Cabine intérieure"
  occupation: Occupation.nullable(),
  date_depart: DateISO, // toujours présent
  date_retour: DateISO.nullable(),
  duree_nuits: z.number().int().positive().nullable(),
  duree_jours: z.number().int().positive().nullable(),
  prix_par_personne: z.number().positive(), // toujours présent
  taxes_incluses: z.boolean().nullable(),
});

// Complément optionnel structuré (plan boissons, wifi, crédit excursion).
// PAS un second prix : un complément avec son nom et son montant.
const Supplement = z.object({
  nom: z.string(),
  montant: z.number().positive(),
  par_personne: z.boolean().nullable(), // "+370$ par personne"
});

// Escale de croisière ou étape de circuit.
const Etape = z.object({
  lieu: z.string(),
  pays: z.string().nullable(),
  jour: z.number().int().positive().nullable(),
});

// Objet de base (sans refine) — sert à générer le JSON Schema des structured outputs.
export const FaitsBase = z.object({
  // ── Commun (→ colonnes offres) ──
  type_produit: TypeProduit.nullable(),
  fournisseur: z.string().nullable(),
  destination_pays: z.string().nullable(), // nullable : post sans destination, croisière multi-pays
  destination_ville: z.string().nullable(),
  devise: z.string().nullable(), // défaut 'CAD' porté par la colonne DB
  prix_valide_jusqua: DateISO.nullable(),
  compagnie_aerienne: z.string().nullable(),
  aeroport_depart: z.string().nullable(), // défaut 'YUL' porté par la colonne DB
  aeroports_alternatifs: z.array(z.string()).nullable(),
  lien_reservation: z.string().nullable(),
  lien_tripadvisor: z.string().nullable(),
  lien_monarc: z.string().nullable(),

  // ── Formule principale (aplatie → colonnes offres) ──
  ...Formule.shape,

  // ── Variante « double » éventuelle (Formule complète) ──
  formule_secondaire: Formule.nullable(),

  // ── Listes → contenus.fr ──
  inclusions: z.array(z.string()).nullable(), // règle : valeur monétaire / facturable → inclusion
  exclusions: z.array(z.string()).nullable(),
  itineraire: z.array(Etape).nullable(),

  // ── Compléments et particularités ──
  supplements: z.array(Supplement).nullable(),
  notes: z.array(z.string()).nullable(), // règle : qualitatif → note
});

// Schéma complet avec cohérences métier (validation côté client, Appel 1).
export const FaitsExtraction = FaitsBase.refine(
  (o) => o.date_retour == null || o.date_retour >= o.date_depart,
  { message: "date_retour antérieure à date_depart", path: ["date_retour"] },
).refine(
  (o) =>
    o.formule_secondaire == null ||
    o.formule_secondaire.date_retour == null ||
    o.formule_secondaire.date_retour >= o.formule_secondaire.date_depart,
  {
    message: "date_retour secondaire incohérente",
    path: ["formule_secondaire", "date_retour"],
  },
);

export type Faits = z.infer<typeof FaitsBase>;
