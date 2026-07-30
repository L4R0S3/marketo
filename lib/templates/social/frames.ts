import { readFileSync } from "node:fs";
import path from "node:path";
import { THEMES, type ThemeT } from "./themes";

// Chargement des frames pour Satori. Comme les polices, ils sont lus sur le
// disque et mis en cache : Satori ne va pas chercher une URL relative, et un
// data URI évite de dépendre de l'adresse publique du déploiement.
// next.config.ts force l'inclusion de public/frames dans le traçage Vercel.

const cache = new Map<ThemeT, string>();

export function frameEnDataUri(theme: ThemeT): string {
  const dejaLu = cache.get(theme);
  if (dejaLu) return dejaLu;

  const fichier = path.join(process.cwd(), "public", "frames", THEMES[theme].fichier);
  const uri = "data:image/png;base64," + readFileSync(fichier).toString("base64");
  cache.set(theme, uri);
  return uri;
}
