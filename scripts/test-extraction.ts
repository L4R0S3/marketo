// Test réel de l'Appel 1 sur les captures de fixtures/posts/.
// Lance : npm run test:extraction
//
// Pour chaque capture : appelle claude-sonnet-5 avec le VRAI prompt et le VRAI
// schéma (structured outputs), affiche le JSON brut, joue FaitsExtraction.safeParse,
// vérifie l'usage des SENTINELLES ("" / [] = absent, jamais une invention), puis
// montre le résultat après nettoyerSentinelles() — ce qui partira réellement en base.

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { SortieExtraction, FaitsExtraction } from "../lib/schema/offre";
import { nettoyerSentinelles } from "../lib/extraction/sentinelles";
import { PROMPT_SYSTEME_EXTRACTION } from "../lib/extraction/prompt";

process.loadEnvFile(".env.local");
const anthropic = new Anthropic();

// Un motif facultatif limite le test à certaines captures (aucun appel inutile) :
//   npm run test:extraction -- 141746
const motif = process.argv[2]?.toLowerCase();
const DOSSIER = "fixtures/posts";
const fichiers = readdirSync(DOSSIER)
  .filter((f) => f.toLowerCase().endsWith(".png"))
  .filter((f) => !motif || f.toLowerCase().includes(motif))
  .sort();

// Champs texte scrutés : une valeur inventée y est plus coûteuse qu'ailleurs.
const TEXTES_SURVEILLES = [
  "fournisseur",
  "destination_pays",
  "devise",
  "compagnie_aerienne",
  "aeroport_depart",
  "prix_valide_jusqua",
  "occupation",
  "type_produit",
  "type_cabine",
  "etablissement_categorie",
  "lien_reservation",
  "lien_tripadvisor",
  "lien_monarc",
];
const LISTES_SURVEILLEES = [
  "inclusions",
  "exclusions",
  "itineraire",
  "supplements",
  "notes",
  "aeroports_alternatifs",
];

async function tester(fichier: string, i: number) {
  const b64 = readFileSync(path.join(DOSSIER, fichier)).toString("base64");
  const r = await anthropic.messages.parse({
    model: "claude-sonnet-5",
    max_tokens: 16000,
    system: PROMPT_SYSTEME_EXTRACTION,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/png", data: b64 } },
          { type: "text", text: "Extrais les faits de ce document." },
        ],
      },
    ],
    output_config: { format: zodOutputFormat(SortieExtraction) },
  });

  const out = r.parsed_output;
  console.log(`\n\n========== POST ${i + 1} — ${fichier} ==========`);
  console.log("--- JSON retourné par le modèle (avec sentinelles) ---");
  console.log(JSON.stringify(out, null, 2));

  if (!out) {
    console.log(">>> parsed_output NULL");
    return;
  }
  if (out.statut === "erreur" || !out.faits) {
    console.log(`>>> statut=erreur : ${out.erreur}`);
    return;
  }

  const v = FaitsExtraction.safeParse(out.faits);
  console.log(`\n>>> safeParse : ${v.success ? "PASS" : "FAIL"}`);
  if (!v.success) {
    for (const iss of v.error.issues) {
      console.log(`     - ${iss.path.join(".") || "(racine)"}: ${iss.message}`);
    }
  }

  // Usage des sentinelles : que vaut chaque champ surveillé, et le modèle
  // a-t-il bien laissé "" / [] plutôt que d'inventer ou d'omettre ?
  const f = out.faits as Record<string, unknown>;
  const vides: string[] = [];
  const remplis: string[] = [];
  const anomalies: string[] = [];
  for (const champ of TEXTES_SURVEILLES) {
    const val = f[champ];
    if (val === undefined) anomalies.push(`${champ} OMIS (sentinelle "" attendue)`);
    else if (val === "") vides.push(champ);
    else remplis.push(`${champ}=${JSON.stringify(val)}`);
  }
  for (const champ of LISTES_SURVEILLEES) {
    const val = f[champ];
    if (val === undefined) anomalies.push(`${champ} OMIS (sentinelle [] attendue)`);
    else if (Array.isArray(val) && val.length === 0) vides.push(champ);
    else if (Array.isArray(val)) remplis.push(`${champ}[${val.length}]`);
  }
  console.log(`>>> sentinelles vides ("" / []) : ${vides.length ? vides.join(", ") : "aucune"}`);
  console.log(`>>> champs renseignés : ${remplis.join("  ") || "aucun"}`);
  console.log(`>>> anomalies : ${anomalies.length ? anomalies.join(" ; ") : "aucune"}`);
  console.log(
    `>>> formule_secondaire : ${f.formule_secondaire === undefined ? "omise" : "présente"}`,
  );

  if (v.success) {
    console.log("\n--- Après nettoyerSentinelles() (ce qui part en base) ---");
    console.log(JSON.stringify(nettoyerSentinelles(v.data), null, 2));
  }
}

async function main() {
  console.log(`${fichiers.length} capture(s) : ${fichiers.join(", ")}`);
  for (let i = 0; i < fichiers.length; i++) {
    await tester(fichiers[i], i);
  }
  console.log("\n\nTerminé.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
