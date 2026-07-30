// Compile les deux variantes du gabarit courriel sur une offre de démonstration
// et écrit le HTML dans rendus/, prêt à ouvrir dans un navigateur.
// Lance : npm run test:courriel
//
// Aucun réseau, aucune base : c'est le même chemin de code que l'application.

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { compiler } from "../lib/templates/email/compiler";
import { campagneMjml, blocSeulMjml } from "../lib/templates/email/campagne.mjml";
import type { BlocOffre } from "../lib/templates/email/donnees";

const SORTIE = "rendus";
const photo = (t: string, w: number, h: number) =>
  `https://placehold.co/${w}x${h}/e2e8f0/718096?text=${encodeURIComponent(t)}`;

const vedette: BlocOffre = {
  slug: "santo-domingo-tout-inclus-7-nuits",
  titre: "Santo Domingo tout inclus 7 nuits",
  etablissement: "Emotions By Hodelpa Juan Dolio",
  destination: "Santo Domingo, République dominicaine",
  categorie: "4 étoiles",
  etoiles: 4,
  details: [
    { libelle: "Séjour", valeur: "31 juillet au 7 août (7 nuits)" },
    { libelle: "Formule", valeur: "Tout inclus" },
    { libelle: "Vol", valeur: "Air Transat, au départ de YUL" },
    { libelle: "Rabais", valeur: "310 $ par personne" },
  ],
  prix: 2839,
  prixAvantRabais: 3149,
  mentions: ["par personne", "occ. double", "taxes incluses"],
  hero: photo("Hero+600x320", 600, 320),
  galerie: [photo("Chambre", 300, 220), photo("Plage", 300, 220)],
};

const condense: BlocOffre = {
  slug: "croisiere-canal-de-panama",
  titre: "Croisière au Canal de Panama",
  etablissement: "MSC Poesia",
  destination: "Seattle à Miami",
  categorie: "Classe Musica",
  etoiles: null,
  details: [
    { libelle: "Séjour", valeur: "27 septembre au 18 octobre (20 nuits)" },
    { libelle: "Cabine", valeur: "Cabine balcon" },
    { libelle: "Vol", valeur: "Air Canada, au départ de YUL" },
  ],
  prix: 2599,
  prixAvantRabais: null,
  mentions: ["par personne", "occ. double", "taxes incluses"],
  hero: photo("Hero+600x250", 600, 250),
  galerie: [photo("Pont", 300, 160), photo("Escale", 300, 160)],
};

async function ecrire(nom: string, mjml: string) {
  const { html, avertissements } = await compiler(mjml);
  const cible = path.join(SORTIE, nom);
  writeFileSync(cible, html);
  console.log(
    `${cible.padEnd(34)} ${(html.length / 1024).toFixed(0)} Ko` +
      (avertissements.length ? `  ⚠ ${avertissements.length} avertissement(s)` : ""),
  );
  avertissements.forEach((a) => console.log("     " + a));
}

async function main() {
  mkdirSync(SORTIE, { recursive: true });
  await ecrire("courriel-bloc-vedette.html", blocSeulMjml(vedette, "vedette"));
  await ecrire("courriel-bloc-condense.html", blocSeulMjml(condense, "condense"));
  await ecrire(
    "courriel-campagne.html",
    campagneMjml(
      [
        { offre: vedette, variante: "vedette" },
        { offre: condense, variante: "condense" },
        {
          offre: {
            ...condense,
            slug: "grand-tour-du-maroc",
            etablissement: "Grand tour du Maroc",
            destination: "Maroc",
            prix: 2348,
            etoiles: 4,
            categorie: "3 et 4 étoiles",
          },
          variante: "condense",
        },
      ],
      "Nos offres de la semaine",
    ),
  );
}
main();
