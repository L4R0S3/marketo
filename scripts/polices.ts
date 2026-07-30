// Sous-ensemblage des polices du gabarit social — REPRODUCTIBLE (CLAUDE.md §7).
// Lance : npm run polices
//
// Satori ne lit pas un @font-face distant : il charge des fichiers en mémoire, et
// le bundle d'ImageResponse est plafonné à 500 Ko. Les fichiers complets de Google
// Fonts pèsent 150 à 500 Ko chacun ; sous-ensemblés au jeu de caractères réellement
// utilisé, ils tombent sous 30 Ko.
//
// Polices retenues : Anton (titre + prix) et Raleway (tout le reste).
// Raleway est téléchargée en DEUX graisses : le gabarit met en gras des segments
// au milieu d'une ligne (**CABINE BALCON**, §6) et une seule graisse ne peut pas
// rendre ce contraste — Satori ne synthétise pas le gras.

import { writeFileSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";
import subsetFont from "subset-font";

// Jeu de caractères minimal (CLAUDE.md §7) + apostrophe typographique et
// quelques signes présents dans les posts réels.
const CARACTERES = [
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  "abcdefghijklmnopqrstuvwxyz",
  "0123456789",
  "àâäçéèêëîïôöùûüÿ",
  "ÀÂÄÇÉÈÊËÎÏÔÖÙÛÜŸ",
  "$&→!?'’()[],.:;/+%°«»\"- ",
].join("");

// Source : le dépôt officiel google/fonts, qui sert les vrais fichiers TrueType.
// (L'API CSS de Google renvoie du woff2 même à un navigateur ancien, et Satori ne
// lit pas le woff2.) Raleway n'y existe qu'en police VARIABLE : on en extrait deux
// instances de graisse au moment du sous-ensemblage.
const DEPOT = "https://raw.githubusercontent.com/google/fonts/main/ofl";

const POLICES = [
  { fichier: "anton-regular.ttf", url: `${DEPOT}/anton/Anton-Regular.ttf`, graisse: null },
  { fichier: "raleway-400.ttf", url: `${DEPOT}/raleway/Raleway%5Bwght%5D.ttf`, graisse: 400 },
  { fichier: "raleway-700.ttf", url: `${DEPOT}/raleway/Raleway%5Bwght%5D.ttf`, graisse: 700 },
];

const DESTINATION = "public/fonts";

// Un fichier sfnt commence par 0x00010000 (TrueType), « true » ou « OTTO ».
function estSfnt(buf: Buffer): boolean {
  const tag = buf.subarray(0, 4);
  return (
    tag.readUInt32BE(0) === 0x00010000 ||
    tag.toString("latin1") === "true" ||
    tag.toString("latin1") === "OTTO"
  );
}

async function main() {
  mkdirSync(DESTINATION, { recursive: true });
  console.log(`Jeu de caractères : ${CARACTERES.length} signes\n`);

  for (const p of POLICES) {
    const res = await fetch(p.url);
    if (!res.ok) throw new Error(`${p.fichier} : téléchargement ${res.status}`);
    const complet = Buffer.from(await res.arrayBuffer());
    if (!estSfnt(complet))
      throw new Error(
        `${p.fichier} : format non TrueType reçu. Satori ne lit que ttf/otf/woff.`,
      );

    // Une police variable est figée à la graisse demandée : Satori ne pilote pas
    // les axes de variation, il lui faut un fichier par graisse.
    const reduit = await subsetFont(complet, CARACTERES, {
      targetFormat: "truetype",
      // Sans fermeture de layout : on ne garde pas les glyphes que les tables
      // OpenType pourraient atteindre (ligatures, alternates) — le gabarit n'en
      // utilise aucune, et c'est ce qui pèse le plus lourd.
      noLayoutClosure: true,
      ...(p.graisse ? { variationAxes: { wght: p.graisse } } : {}),
    });

    const cible = path.join(DESTINATION, p.fichier);
    writeFileSync(cible, reduit);
    const ko = (n: number) => `${(n / 1024).toFixed(1)} Ko`;
    const taille = statSync(cible).size;
    console.log(
      `${p.fichier.padEnd(20)} ${ko(complet.length).padStart(9)} → ${ko(taille).padStart(8)}` +
        `${taille > 30 * 1024 ? "   ⚠ au-dessus de la cible de 30 Ko" : ""}`,
    );
  }
  console.log("\nFichiers écrits dans public/fonts/. Ils sont versionnés : ne relance ce");
  console.log("script que pour changer de police ou de jeu de caractères.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
