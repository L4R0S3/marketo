import type { Faits } from "@/lib/schema/offre";

// Couche de CONVERSION des sentinelles de l'Appel 1 (cf. l'encadré en tête de
// lib/schema/offre.ts). Le schéma Zod VALIDE la forme, cette fonction TRANSFORME
// le résultat — les deux restent séparés, et nettoyerSentinelles() ne s'exécute
// qu'après un parse réussi.
//
//   ""  → null   (chaîne vide = fait absent du document)
//   []  → null   (liste vide  = aucun élément dans le document)
//
// Les champs numériques et booléens n'ont pas de sentinelle : ils sont
// simplement omis (undefined) et le restent ici. C'est la route qui pose le
// `?? null` au moment d'écrire en colonne.

// Type des faits une fois les sentinelles converties : toute chaîne (y compris
// une valeur d'enum) et tout tableau peuvent valoir null ; le reste est inchangé.
export type SansSentinelles<T> = T extends string
  ? Exclude<T, ""> | null
  : T extends Array<infer U>
    ? Array<SansSentinelles<U>> | null
    : T extends object
      ? { [K in keyof T]: SansSentinelles<T[K]> }
      : T;

export type FaitsNettoyes = SansSentinelles<Faits>;

function convertir(valeur: unknown): unknown {
  if (valeur === "") return null;
  if (Array.isArray(valeur)) {
    return valeur.length === 0 ? null : valeur.map(convertir);
  }
  if (valeur !== null && typeof valeur === "object") {
    const sortie: Record<string, unknown> = {};
    for (const [cle, v] of Object.entries(valeur)) sortie[cle] = convertir(v);
    return sortie;
  }
  return valeur;
}

export function nettoyerSentinelles(faits: Faits): FaitsNettoyes {
  return convertir(faits) as FaitsNettoyes;
}
