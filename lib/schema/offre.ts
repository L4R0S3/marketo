import { z } from "zod";

// Source de vérité des FAITS extraits (Appel 1). Aucun texte composé, aucune
// contrainte de longueur — uniquement des faits. La cohérence métier (dates,
// prix > 0) est vérifiée côté client par les refine ; les structured outputs
// ne portent que la forme.
//
// IMPORTANT — champs .optional() et NON .nullable(). Les structured outputs
// plafonnent à 16 paramètres à union (anyOf / type-array). Or .nullable() génère
// un anyOf:[type,null] par champ : avec ~27 champs facultatifs on dépasse (400
// « too many parameters with union types »). .optional() encode un type simple et
// retire le champ de `required` (zéro union). Donc, ici, un fait absent du document
// est OMIS de la sortie (undefined), il n'est jamais renvoyé à null.
// Seuls date_depart et prix_par_personne sont requis (présents dans toute offre
// exploitable ; sinon le modèle renvoie statut = "erreur", cf. SortieExtraction).

// Date ISO (YYYY-MM-DD). Les chaînes ISO se comparent lexicographiquement.
const DateISO = z.iso.date();

const Occupation = z.enum(["simple", "double", "triple", "quadruple"]);
const TypeProduit = z.enum(["forfait", "croisiere", "circuit"]);
const TypeEtablissement = z.enum(["hotel", "navire", "multiple"]);

// Une « formule » = navire/hôtel + catégorie + type de cabine + dates + prix.
// La formule PRINCIPALE est aplatie au niveau racine (mappe 1:1 aux colonnes de
// la table offres). Une formule_secondaire présente = variante « double »
// (comparaison de deux navires/dates, ex. post MSC SOLO).
const Formule = z.object({
  etablissement_nom: z.string().optional(), // navire ou hôtel
  etablissement_type: TypeEtablissement.optional(),
  etablissement_categorie: z.string().optional(), // VRAIE catégorie : étoiles d'hôtel, classe de navire
  type_cabine: z.string().optional(), // "Cabine balcon", "Studio solo intérieur", "Cabine intérieure"
  occupation: Occupation.optional(),
  date_depart: DateISO, // toujours présent
  date_retour: DateISO.optional(),
  duree_nuits: z.number().int().positive().optional(),
  duree_jours: z.number().int().positive().optional(),
  prix_par_personne: z.number().positive(), // toujours présent
  taxes_incluses: z.boolean().optional(),
});

// Complément optionnel structuré (plan boissons, wifi, crédit excursion).
// PAS un second prix : un complément avec son nom et son montant.
const Supplement = z.object({
  nom: z.string(),
  montant: z.number().positive(),
  par_personne: z.boolean().optional(), // "+370$ par personne"
});

// Escale de croisière ou étape de circuit.
const Etape = z.object({
  lieu: z.string(),
  pays: z.string().optional(),
  jour: z.number().int().positive().optional(),
});

// Objet de base (sans refine) — sert à générer le JSON Schema des structured outputs.
export const FaitsBase = z.object({
  // ── Commun (→ colonnes offres) ──
  type_produit: TypeProduit.optional(),
  fournisseur: z.string().optional(),
  destination_pays: z.string().optional(), // omis : post sans destination, croisière multi-pays
  destination_ville: z.string().optional(),
  devise: z.string().optional(), // défaut 'CAD' porté par la colonne DB
  prix_valide_jusqua: DateISO.optional(),
  compagnie_aerienne: z.string().optional(),
  aeroport_depart: z.string().optional(), // défaut 'YUL' porté par la colonne DB
  aeroports_alternatifs: z.array(z.string()).optional(),
  lien_reservation: z.string().optional(),
  lien_tripadvisor: z.string().optional(),
  lien_monarc: z.string().optional(),

  // ── Formule principale (aplatie → colonnes offres) ──
  ...Formule.shape,

  // ── Variante « double » éventuelle (Formule complète) ──
  formule_secondaire: Formule.optional(),

  // ── Listes → contenus.fr ──
  inclusions: z.array(z.string()).optional(), // règle : valeur monétaire / facturable → inclusion
  exclusions: z.array(z.string()).optional(),
  itineraire: z.array(Etape).optional(),

  // ── Compléments et particularités ──
  supplements: z.array(Supplement).optional(),
  notes: z.array(z.string()).optional(), // règle : qualitatif → note
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

// Enveloppe de sortie de l'Appel 1. Les structured outputs FORCENT la forme :
// sans cette enveloppe, un document illisible obligerait le modèle à halluciner
// prix_par_personne / date_depart (champs requis) pour satisfaire le schéma.
// Avec statut = "erreur", le modèle signale l'échec SANS remplir les faits.
export const SortieExtraction = z.object({
  statut: z.enum(["ok", "erreur"]),
  faits: FaitsBase.optional(), // présent si statut = "ok", omis sinon
  erreur: z.string().optional(), // description du problème si statut = "erreur"
});
export type SortieExtractionT = z.infer<typeof SortieExtraction>;
