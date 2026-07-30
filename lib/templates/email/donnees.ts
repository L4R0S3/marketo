import { urlPhoto } from "@/lib/supabase/public";

// Ce qu'un bloc courriel a besoin de savoir sur une offre. Construit à partir
// des colonnes (faits corrigés par l'opérateur) et de contenus.fr (texte validé),
// jamais de extraction_brute : le courriel ne montre que du validé.

export type BlocOffre = {
  slug: string;
  titre: string;
  etablissement: string | null;
  destination: string | null;
  categorie: string | null;
  etoiles: number | null;
  /** Lignes de détails, déjà rédigées : { libelle, valeur }. */
  details: { libelle: string; valeur: string }[];
  prix: number;
  prixAvantRabais: number | null;
  mentions: string[];
  hero: string | null;
  galerie: string[];
};

type Photo = { url: string; role: string };

const texte = (v: unknown): string | null => {
  const s = v == null ? "" : String(v).trim();
  return s === "" ? null : s;
};

// « 4 étoiles », « 3 et 4 étoiles », « Classe Musica » → 4 ou null. Sert à la
// rangée d'étoiles des références ; sans nombre lisible, on n'en affiche aucune.
function etoilesDe(categorie: string | null): number | null {
  if (!categorie) return null;
  const nombres = [...categorie.matchAll(/(\d)(?:[.,]5)?\s*étoile/gi)].map((m) => Number(m[1]));
  if (nombres.length === 0) return null;
  const max = Math.max(...nombres);
  return max >= 1 && max <= 5 ? max : null;
}

const dateCourte = (iso: string) =>
  new Date(iso + "T12:00:00").toLocaleDateString("fr-CA", { day: "numeric", month: "long" });

export function offreVersBloc(
  offre: Record<string, unknown>,
  photos: Photo[],
): BlocOffre {
  const fr = ((offre.contenus as Record<string, unknown> | null)?.fr ?? {}) as Record<
    string,
    unknown
  >;
  const visuel = fr.visuel as { colonnes?: { prix?: { mentions?: string[] } }[] } | undefined;

  const depart = texte(offre.date_depart);
  const retour = texte(offre.date_retour);
  const nuits = offre.duree_nuits as number | null;
  const jours = offre.duree_jours as number | null;

  const details: { libelle: string; valeur: string }[] = [];

  if (depart && retour)
    details.push({
      libelle: "Séjour",
      valeur: `${dateCourte(depart)} au ${dateCourte(retour)}${nuits ? ` (${nuits} nuits)` : ""}`,
    });
  else if (depart)
    details.push({
      libelle: "Départ",
      valeur: dateCourte(depart) + (nuits ? ` (${nuits} nuits)` : ""),
    });
  else if (nuits || jours)
    details.push({
      libelle: "Durée",
      valeur: jours && nuits ? `${jours} jours / ${nuits} nuits` : `${jours ?? nuits} ${jours ? "jours" : "nuits"}`,
    });

  const cabine = texte(offre.type_cabine);
  if (cabine) details.push({ libelle: "Cabine", valeur: cabine });

  const vol = [texte(offre.compagnie_aerienne), texte(offre.aeroport_depart)]
    .filter(Boolean)
    .join(", au départ de ");
  if (vol) details.push({ libelle: "Vol", valeur: vol });

  const occupation = texte(offre.occupation);
  if (occupation) details.push({ libelle: "Occupation", valeur: occupation });

  const rabais = offre.prix_avant_rabais as number | null;
  const prix = Number(offre.prix_par_personne);
  if (rabais && rabais > prix)
    details.push({ libelle: "Rabais", valeur: `${Math.round(rabais - prix)} $ par personne` });

  const mentionsComposees = visuel?.colonnes?.[0]?.prix?.mentions ?? [];
  const mentions = mentionsComposees.length
    ? mentionsComposees
    : [
        "par personne",
        occupation ? `occ. ${occupation}` : "",
        offre.taxes_incluses ? "taxes incluses" : "",
      ].filter(Boolean);

  const hero = photos.find((p) => p.role === "hero") ?? photos[0];
  const galerie = photos.filter((p) => p !== hero).slice(0, 2);
  const categorie = texte(offre.etablissement_categorie);

  return {
    slug: String(offre.slug),
    titre: (texte(fr.titre) ?? texte(offre.destination_pays) ?? "Votre prochain voyage")!,
    etablissement: texte(offre.etablissement_nom),
    destination:
      [texte(offre.destination_ville), texte(offre.destination_pays)].filter(Boolean).join(", ") ||
      null,
    categorie,
    etoiles: etoilesDe(categorie),
    details,
    prix,
    prixAvantRabais: rabais && rabais > prix ? rabais : null,
    mentions,
    hero: hero ? urlPhoto(hero.url) : null,
    galerie: galerie.map((p) => urlPhoto(p.url)),
  };
}
