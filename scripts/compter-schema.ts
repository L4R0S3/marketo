// Compte les deux budgets des structured outputs sur le JSON Schema RÉELLEMENT
// généré (pas sur une lecture à l'œil du fichier Zod) :
//   • paramètres à union      → plafond 16   (anyOf / oneOf / "type": [..])
//   • paramètres facultatifs  → plafond 24   (propriété absente de `required`)
// Les objets imbriqués comptent. Aucun appel API : lance : npm run test:schema

import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { SortieExtraction } from "../lib/schema/offre";
import { CompositionForme } from "../lib/composition/schema";

type Noeud = {
  type?: string | string[];
  properties?: Record<string, Noeud>;
  required?: string[];
  items?: Noeud;
  anyOf?: unknown[];
  oneOf?: unknown[];
};

let unions: string[] = [];
let facultatifs: string[] = [];

function parcourir(noeud: Noeud, chemin: string) {
  if (noeud.properties) {
    const requis = new Set(noeud.required ?? []);
    for (const [nom, sousNoeud] of Object.entries(noeud.properties)) {
      const p = chemin ? `${chemin}.${nom}` : nom;
      if (!requis.has(nom)) facultatifs.push(p);
      if (sousNoeud.anyOf || sousNoeud.oneOf || Array.isArray(sousNoeud.type)) unions.push(p);
      parcourir(sousNoeud, p);
    }
  }
  if (noeud.items) parcourir(noeud.items, `${chemin}[]`);
}

// zodOutputFormat enveloppe le schéma ; on descend jusqu'au premier objet à propriétés.
function racine(format: unknown): Noeud {
  const f = format as Record<string, unknown>;
  const candidats = [f, f.schema, (f.json_schema as Record<string, unknown> | undefined)?.schema];
  for (const c of candidats) {
    if (c && typeof c === "object" && "properties" in c) return c as Noeud;
  }
  throw new Error("Schéma introuvable dans la sortie de zodOutputFormat : " + JSON.stringify(format).slice(0, 400));
}

function mesurer(titre: string, format: unknown) {
  unions = [];
  facultatifs = [];
  const schema = racine(format);
  parcourir(schema, "");
  console.log(`=== ${titre} ===`);
  console.log(`Paramètres à UNION       : ${unions.length} / 16  ${unions.length <= 16 ? "OK" : "DÉPASSÉ"}`);
  if (unions.length) console.log("  " + unions.join("\n  "));
  console.log(`Paramètres FACULTATIFS   : ${facultatifs.length} / 24  ${facultatifs.length <= 24 ? "OK" : "DÉPASSÉ"}`);
  if (facultatifs.length) console.log("  " + facultatifs.join("\n  "));
  console.log(`JSON Schema : ${JSON.stringify(schema).length} caractères.\n`);
}

mesurer("Appel 1 — SortieExtraction (les faits)", zodOutputFormat(SortieExtraction));
mesurer("Appel 2 — CompositionForme (le texte)", zodOutputFormat(CompositionForme));
