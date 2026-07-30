import { readFileSync } from "node:fs";
import path from "node:path";

// Chargement des polices du gabarit pour Satori. Elles sont lues sur le disque
// (Satori ne sait pas charger un @font-face distant) et mises en cache : le
// fichier n'est lu qu'une fois par instance de fonction.
//
// Les fichiers sont sous-ensemblés — voir scripts/polices.ts, `npm run polices`.
// Anton : titre et prix. Raleway 400/700 : tout le reste, la graisse 700 servant
// au gras partiel (**segment**) au milieu d'une ligne.
// next.config.ts force l'inclusion de public/fonts dans le traçage Vercel.

export type PoliceSatori = {
  name: string;
  data: Buffer;
  weight: 400 | 700;
  style: "normal";
};

const FICHIERS = [
  { fichier: "anton-regular.ttf", name: "Anton", weight: 400 as const },
  { fichier: "raleway-400.ttf", name: "Raleway", weight: 400 as const },
  { fichier: "raleway-700.ttf", name: "Raleway", weight: 700 as const },
];

let cache: PoliceSatori[] | null = null;

export function chargerPolices(): PoliceSatori[] {
  cache ??= FICHIERS.map((f) => ({
    name: f.name,
    data: readFileSync(path.join(process.cwd(), "public", "fonts", f.fichier)),
    weight: f.weight,
    style: "normal" as const,
  }));
  return cache;
}
