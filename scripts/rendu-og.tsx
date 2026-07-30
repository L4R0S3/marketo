// Rendu local du gabarit social, sans serveur ni base : écrit des PNG dans
// rendus/ pour comparer à l'œil avec les posts originaux.
// Lance : npm run rendu
//
// Même chemin de code que la route /api/og/[id] (Gabarit + ImageResponse + les
// polices sous-ensemblées) : ce qui sort ici est ce que sortira la production.

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ImageResponse } from "next/og";
import { Gabarit, LARGEUR, HAUTEUR } from "../lib/templates/social/Gabarit";
import { chargerPolices } from "../lib/templates/social/polices";
import type { PostVisuelT } from "../lib/templates/social/schema";

const DOSSIER = "rendus";

// Photo de fond : faute de banque d'images, on réutilise une capture comme photo
// hero — l'objectif est de vérifier la lisibilité sur un fond chargé.
const photo =
  "data:image/png;base64," +
  readFileSync(path.join("fixtures/posts", "Capture d’écran 2026-07-29 141732.png")).toString(
    "base64",
  );

const panama: PostVisuelT = {
  variante: "simple",
  theme: "azur",
  photo: { url: photo, focale: "centre" },
  titre: "Croisière au Canal de Panama",
  bandeau: "21 jours, vols et hôtels inclus, départ 27 sept 2026",
  colonnes: [
    {
      entete: null,
      blocs: [
        { lignes: ["Croisière de 21 jours à travers le **Canal de Panama**"] },
        {
          lignes: [
            "Seattle, Los Angeles, San Diego, Cabo San Lucas,",
            "Puntarenas, Cartagène et Miami",
          ],
        },
        {
          lignes: [
            "Vols, hôtels et croisière inclus",
            "Une nuit avant à Seattle et une nuit après à Miami",
          ],
        },
        { lignes: ["Départ du **27 septembre 2026** depuis Montréal (YUL)"] },
      ],
      prix: {
        surtitre: "À partir de seulement",
        montant: 2599,
        mentions: ["/personne,", "occ. double,", "taxes incluses."],
      },
    },
  ],
  prix_secondaire: null,
  badge: null,
};

// Variante double + prix secondaire + badge : le cas le plus chargé du gabarit.
const solo: PostVisuelT = {
  variante: "double",
  theme: "framboise",
  photo: { url: photo, focale: "centre" },
  titre: "Votre cabine SOLO vous attend!",
  bandeau: "2 forfaits vols & croisière solo, au départ de Montréal",
  colonnes: [
    {
      entete: "MSC World Europa",
      blocs: [
        { lignes: ["**Studio solo intérieur**, meilleur tarif :", "16 au 23 janvier 2027"] },
        { lignes: ["Vols et transferts inclus!"] },
      ],
      prix: {
        surtitre: "À partir de :",
        montant: 2899,
        mentions: ["par personne,", "occ. simple, tx in."],
      },
    },
    {
      entete: "MSC Opera",
      blocs: [
        { lignes: ["**Cabine intérieure**, meilleur tarif :", "7 au 14 décembre 2026"] },
        { lignes: ["Vols et transferts inclus!"] },
      ],
      prix: {
        surtitre: "À partir de :",
        montant: 1949,
        mentions: ["par personne,", "occ. simple, tx in."],
      },
    },
  ],
  prix_secondaire: {
    surtitre: "Plan boissons & wifi",
    montant: 504,
    mentions: ["par personne"],
  },
  badge: { texte: "Départs de Québec possibles!", icone: "yqb" },
};

async function rendre(nom: string, visuel: PostVisuelT) {
  const reponse = new ImageResponse(<Gabarit visuel={visuel} />, {
    width: LARGEUR,
    height: HAUTEUR,
    fonts: chargerPolices(),
  });
  const png = Buffer.from(await reponse.arrayBuffer());
  const cible = path.join(DOSSIER, `${nom}.png`);
  writeFileSync(cible, png);
  console.log(`${cible.padEnd(28)} ${(png.length / 1024).toFixed(0)} Ko`);
}

async function main() {
  mkdirSync(DOSSIER, { recursive: true });
  await rendre("panama-simple", panama);
  await rendre("solo-double", solo);
  console.log("\nOuvre les fichiers de rendus/ pour comparer avec les originaux.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
