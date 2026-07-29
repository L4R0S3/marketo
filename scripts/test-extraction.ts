// Test réel de l'Appel 1 sur les captures de fixtures/posts/.
// Lance : npm run test:extraction
//
// Pour chaque capture : appelle claude-sonnet-5 avec le VRAI prompt et le VRAI
// schéma (structured outputs), affiche le JSON brut, joue FaitsExtraction.safeParse,
// et vérifie que les champs nullable renvoient bien null (pas "" ni une invention).

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { SortieExtraction, FaitsExtraction } from "../lib/schema/offre";
import { PROMPT_SYSTEME_EXTRACTION } from "../lib/extraction/prompt";

process.loadEnvFile(".env.local");
const anthropic = new Anthropic();

const DOSSIER = "fixtures/posts";
const fichiers = readdirSync(DOSSIER)
  .filter((f) => f.toLowerCase().endsWith(".png"))
  .sort();

// Champs nullable clés à surveiller (doivent être null, pas "" ni inventés, si absents).
const NULLABLES = [
  "fournisseur",
  "destination_pays",
  "devise",
  "compagnie_aerienne",
  "aeroport_depart",
  "prix_valide_jusqua",
  "formule_secondaire",
];

function inspecterSchema() {
  const fmt = zodOutputFormat(SortieExtraction) as unknown as {
    schema?: { properties?: Record<string, unknown> };
    json_schema?: { schema?: { properties?: Record<string, unknown> } };
  };
  const schema = fmt.schema ?? fmt.json_schema?.schema ?? (fmt as unknown as { properties?: unknown });
  const props =
    (schema as { properties?: Record<string, unknown> }).properties ?? {};
  // faits = FaitsBase.nullable() ; on regarde comment le null est encodé.
  const faits = props["faits"] as { properties?: Record<string, unknown> } | undefined;
  const destination = faits?.properties?.["destination_pays"];
  console.log("=== JSON Schema généré pour un .nullable() ===");
  console.log("faits (FaitsBase.nullable) :", JSON.stringify(faits && Object.keys(faits).length ? Object.keys(faits) : faits));
  console.log("faits.destination_pays (string.nullable) :", JSON.stringify(destination));
  console.log("racine statut/faits/erreur :", JSON.stringify(Object.keys(props)));
  console.log();
}

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
  console.log(`>>> safeParse : ${v.success ? "PASS ✅" : "FAIL ❌"}`);
  if (!v.success) {
    for (const iss of v.error.issues) {
      console.log(`     - ${iss.path.join(".")}: ${iss.message}`);
    }
  }

  // Vérif nullable : null OK ; "" ou valeur douteuse à signaler.
  const f = out.faits as Record<string, unknown>;
  const suspects: string[] = [];
  for (const champ of NULLABLES) {
    const val = f[champ];
    if (val === "") suspects.push(`${champ} = "" (chaîne vide au lieu de null)`);
  }
  console.log(">>> nullable :", suspects.length ? suspects.join(" ; ") : "aucune chaîne vide, null respecté");
  console.log(
    `     fournisseur=${JSON.stringify(f.fournisseur)}  devise=${JSON.stringify(f.devise)}  aeroport_depart=${JSON.stringify(f.aeroport_depart)}  destination_pays=${JSON.stringify(f.destination_pays)}  formule_secondaire=${f.formule_secondaire === null ? "null" : "présente"}`,
  );
}

async function main() {
  inspecterSchema();
  for (let i = 0; i < fichiers.length; i++) {
    await tester(fichiers[i], i);
  }
  console.log("\n\nTerminé.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
