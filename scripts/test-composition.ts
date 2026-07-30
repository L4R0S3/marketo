// Test réel de l'Appel 2 (composition) sur une capture de fixtures/posts/.
// Lance : npm run test:composition            (défaut : le post Panama, 141732)
//         npm run test:composition -- 141652  (autre capture)
//
// Chaîne complète : Appel 1 (faits) → nettoyerSentinelles → Appel 2 (texte) →
// assemblerPostVisuel. Affiche le JSON composé, l'audit des longueurs champ par
// champ, et le PostVisuel final tel qu'il partira au gabarit.

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { SortieExtraction, FaitsExtraction } from "../lib/schema/offre";
import { nettoyerSentinelles } from "../lib/extraction/sentinelles";
import { PROMPT_SYSTEME_EXTRACTION } from "../lib/extraction/prompt";
import { composerTexte } from "../lib/composition/client";
import { assemblerPostVisuel, LIMITES_TEXTE } from "../lib/composition/schema";
import { LIMITES } from "../lib/templates/social/schema";

process.loadEnvFile(".env.local");
const anthropic = new Anthropic();

const motif = (process.argv[2] ?? "141732").toLowerCase(); // Panama par défaut
const DOSSIER = "fixtures/posts";
const fichier = readdirSync(DOSSIER).find(
  (f) => f.toLowerCase().endsWith(".png") && f.toLowerCase().includes(motif),
);
if (!fichier) throw new Error(`Aucune capture ne correspond à « ${motif} »`);

// Audit des longueurs : ce que Zod a laissé passer, mesuré à la main pour l'œil.
function auditer(etiquette: string, valeur: string, max: number) {
  const n = valeur.length;
  const marque = n > max ? "DÉPASSE" : n > max - 4 ? "limite" : "ok";
  console.log(`  ${String(n).padStart(3)}/${max}  ${marque.padEnd(7)} ${etiquette} : ${valeur}`);
}

async function main() {
  console.log(`Capture : ${fichier}\n`);

  // ── Appel 1 ──
  const b64 = readFileSync(path.join(DOSSIER, fichier!)).toString("base64");
  const r1 = await anthropic.messages.parse({
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

  const sortie = r1.parsed_output;
  if (!sortie || sortie.statut === "erreur" || !sortie.faits) {
    console.log(`Appel 1 en erreur : ${sortie?.erreur ?? "pas de sortie"}`);
    return;
  }
  const valide = FaitsExtraction.safeParse(sortie.faits);
  if (!valide.success) {
    console.log("Appel 1 : safeParse FAIL", valide.error.issues);
    return;
  }
  const faits = nettoyerSentinelles(valide.data);
  console.log("--- FAITS transmis à l'Appel 2 ---");
  console.log(JSON.stringify(faits, null, 2));

  // ── Appel 2 ──
  const r2 = await composerTexte(faits as Record<string, unknown>);
  if (!r2.ok) {
    console.log(`\n>>> Appel 2 ÉCHEC : ${r2.erreur}`);
    return;
  }
  const c = r2.composition;
  console.log(`\n--- COMPOSITION (relance utilisée : ${r2.relance ? "OUI" : "non"}) ---`);
  console.log(JSON.stringify(c, null, 2));

  // ── Audit des longueurs ──
  console.log("\n--- LONGUEURS ---");
  auditer("titre", c.titre, LIMITES.titre);
  auditer("bandeau", c.bandeau, LIMITES.bandeau);
  c.colonnes.forEach((col, i) => {
    if (col.entete) auditer(`colonne ${i} entete`, col.entete, LIMITES.entete);
    col.blocs.forEach((b, j) =>
      b.lignes.forEach((l, k) => auditer(`colonne ${i} bloc ${j} ligne ${k}`, l, LIMITES.ligne)),
    );
    auditer(`colonne ${i} surtitre`, col.prix.surtitre, LIMITES.surtitre);
    col.prix.mentions.forEach((m, j) =>
      auditer(`colonne ${i} mention ${j}`, m, LIMITES.mention),
    );
  });
  if (c.prix_secondaire) auditer("prix_sec. surtitre", c.prix_secondaire.surtitre, LIMITES.surtitre);
  if (c.badge) auditer("badge", c.badge.texte, LIMITES.badge);
  auditer("accroche", c.accroche, LIMITES_TEXTE.accroche);
  c.faq.forEach((e, i) => auditer(`faq ${i} q`, e.q, LIMITES_TEXTE.question));

  // ── Assemblage (photo + thème viennent de l'app, jamais du modèle) ──
  console.log("\n--- PostVisuel assemblé (photo/thème injectés côté app) ---");
  console.log(
    JSON.stringify(
      assemblerPostVisuel(c, { heroUrl: "https://exemple/photo-hero.jpg", theme: "azur" }),
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
