import { z } from "zod";

// Source de vérité des FAITS extraits (Appel 1). Aucun texte composé, aucune
// contrainte de longueur — uniquement des faits. La cohérence métier (dates,
// prix > 0) est vérifiée côté client par les refine ; les structured outputs
// ne portent que la forme.
//
// ┌─ STRATÉGIE « SENTINELLES » — lire avant de toucher à ce fichier ─────────┐
// Les structured outputs imposent DEUX plafonds, tous deux atteints par un
// schéma de ~40 champs facultatifs (400 à l'exécution) :
//   • ≤ 16 paramètres à union  (.nullable() → anyOf:[type,null])
//   • ≤ 24 paramètres facultatifs (.optional() → champ retiré de `required`)
// Les objets IMBRIQUÉS comptent dans ces budgets.
//
// Règle unique retenue : presque tout est REQUIS, et « absent » s'exprime par
// une SENTINELLE, pas par une omission ni par null :
//   • chaîne  : z.string()        → ""  = absent
//   • tableau : z.array(...)      → []  = absent
//   • nombre  : .optional()       → champ OMIS (0 serait ambigu)
//   • booléen : .optional()       → champ OMIS
//   • objet   : .optional()       → champ OMIS (formule_secondaire, faits)
// Une chaîne vide n'est PAS une valeur métier : la couche de conversion
// `nettoyerSentinelles()` (lib/extraction/sentinelles.ts) transforme "" → null
// et [] → null APRÈS le parse, avant l'écriture en base. Le schéma valide, la
// fonction transforme — les deux ne se mélangent pas.
// Coût : 0 union et 10 facultatifs, donc les deux plafonds sont hors de portée
// et il reste de la marge pour les phases suivantes.
// └──────────────────────────────────────────────────────────────────────────┘

// Date ISO (AAAA-MM-JJ) avec sentinelle : "" = date absente du document.
// Volontairement une z.string() + regex plutôt que z.iso.date() : un type JSON
// simple, aucun `format` exotique envoyé à l'API. Les chaînes ISO se comparent
// lexicographiquement. Aucune date n'est vitale — seul prix_par_personne l'est
// (une offre sans prix n'est pas vendable → chemin d'erreur, pas sentinelle).
const DateISOouVide = z
  .string()
  .regex(/^(\d{4}-\d{2}-\d{2})?$/, "date ISO AAAA-MM-JJ ou chaîne vide attendue");

// Les enums portent leur propre sentinelle "" (un enum reste une chaîne, donc
// la règle des chaînes s'applique). À noter : zodOutputFormat n'émet de toute
// façon pas les enum en contrainte réelle (ils partent en `description`), la
// validation des valeurs se fait donc ici, côté client.
const Occupation = z.enum(["simple", "double", "triple", "quadruple", ""]);
const TypeProduit = z.enum(["forfait", "croisiere", "circuit", ""]);
const TypeEtablissement = z.enum(["hotel", "navire", "multiple", ""]);

// Une « formule » = navire/hôtel + catégorie + type de cabine + dates + prix.
// La formule PRINCIPALE est aplatie au niveau racine (mappe 1:1 aux colonnes de
// la table offres). Une formule_secondaire présente = variante « double »
// (comparaison de deux navires/dates, ex. post MSC SOLO).
const Formule = z.object({
  etablissement_nom: z.string(), // navire ou hôtel — "" si absent
  etablissement_type: TypeEtablissement,
  etablissement_categorie: z.string(), // VRAIE catégorie : étoiles d'hôtel, classe de navire
  type_cabine: z.string(), // "Cabine balcon", "Studio solo intérieur", "Cabine intérieure"
  occupation: Occupation,
  date_depart: DateISOouVide, // "" possible : posts « départs multiples » (cas Maroc)
  date_retour: DateISOouVide,
  duree_nuits: z.number().int().positive().optional(), // omis si absent (0 ambigu)
  duree_jours: z.number().int().positive().optional(),
  // prix_par_personne est TOUJOURS le total taxes incluses : c'est le seul prix
  // que le visuel affiche. Quand le document sépare base et taxes (Sirev :
  // Prix / Taxes / Total), les trois sont extraits — prix_base et taxes ne
  // servent qu'à la fiche, pour que l'opérateur retrouve le détail du document.
  prix_par_personne: z.number().positive(), // toujours présent, jamais de sentinelle
  prix_base: z.number().positive().optional(), // prix avant taxes, omis si absent
  taxes: z.number().positive().optional(), // montant des taxes, omis si absent
  // Tarif régulier annoncé barré (« rabais de 510 $ », « avant 2255 $ »). Sert
  // au prix barré du bloc courriel ; omis si le document n'en annonce pas.
  prix_avant_rabais: z.number().positive().optional(),
  taxes_incluses: z.boolean().optional(), // ce que dit le document, pour la traçabilité
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
  pays: z.string(), // "" si le pays n'est pas indiqué
  jour: z.number().int().positive().optional(), // omis si les jours ne sont pas numérotés
});

// Objet de base (sans refine) — sert à générer le JSON Schema des structured outputs.
export const FaitsBase = z.object({
  // ── Commun (→ colonnes offres) ──
  type_produit: TypeProduit,
  // Sujet central / angle de vente tel que la source le présente (« Canal de
  // Panama », « Cabine solo »). PAS de colonne dédiée : vit dans
  // extraction_brute.extraction et alimente le titre à l'Appel 2.
  theme_voyage: z.string(),
  fournisseur: z.string(),
  destination_pays: z.string(), // "" : post sans destination, croisière multi-pays
  destination_ville: z.string(),
  devise: z.string(), // "" → la colonne DB applique son défaut 'CAD'
  prix_valide_jusqua: DateISOouVide,
  compagnie_aerienne: z.string(),
  aeroport_depart: z.string(), // "" → la colonne DB applique son défaut 'YUL'
  aeroports_alternatifs: z.array(z.string()), // [] si aucun départ alternatif
  lien_reservation: z.string(),
  lien_tripadvisor: z.string(),
  lien_monarc: z.string(),

  // ── Formule principale (aplatie → colonnes offres) ──
  ...Formule.shape,

  // ── Variante « double » éventuelle (Formule complète) ──
  formule_secondaire: Formule.optional(), // objet entier : omis, pas de sentinelle

  // ── Listes → contenus.fr ── ([] = absent)
  inclusions: z.array(z.string()), // règle : valeur monétaire / facturable → inclusion
  exclusions: z.array(z.string()),
  itineraire: z.array(Etape),

  // ── Compléments et particularités ──
  supplements: z.array(Supplement),
  notes: z.array(z.string()), // règle : qualitatif → note
});

// Schéma complet avec cohérences métier (validation côté client, Appel 1).
// Les comparaisons ne s'appliquent que si les DEUX dates sont présentes : une
// sentinelle "" ne se compare pas (elle signifie « absente », pas « la plus petite »).
export const FaitsExtraction = FaitsBase.refine(
  (o) => o.date_retour === "" || o.date_depart === "" || o.date_retour >= o.date_depart,
  { message: "date_retour antérieure à date_depart", path: ["date_retour"] },
).refine(
  (o) =>
    o.formule_secondaire == null ||
    o.formule_secondaire.date_retour === "" ||
    o.formule_secondaire.date_depart === "" ||
    o.formule_secondaire.date_retour >= o.formule_secondaire.date_depart,
  {
    message: "date_retour secondaire incohérente",
    path: ["formule_secondaire", "date_retour"],
  },
);

export type Faits = z.infer<typeof FaitsBase>;

// Enveloppe de sortie de l'Appel 1. Les structured outputs FORCENT la forme :
// sans cette enveloppe, un document illisible obligerait le modèle à halluciner
// prix_par_personne (seul champ vital) pour satisfaire le schéma.
// Avec statut = "erreur", le modèle signale l'échec SANS remplir les faits.
export const SortieExtraction = z.object({
  statut: z.enum(["ok", "erreur"]),
  faits: FaitsBase.optional(), // présent si statut = "ok", omis sinon
  erreur: z.string(), // "" si statut = "ok" (sentinelle, cf. règle des chaînes)
});
export type SortieExtractionT = z.infer<typeof SortieExtraction>;
