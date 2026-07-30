// Vérification à froid des fonctions pures du flux de validation (aucun réseau,
// aucune base) : slug, gras, et les aller-retours formulaire ↔ base.
// Lance : npm run test:formulaire

import {
  FaitsForm,
  VisuelForm,
  faitsFormVersColonnes,
  faitsFormVersContenus,
  visuelFormVersContenus,
  offreVersFaitsForm,
  compositionVersVisuelForm,
  contenusVersComposition,
  slugifier,
} from "../lib/schema/formulaire";
import { parseGras, sansGras } from "../lib/templates/social/parseGras";

let echecs = 0;
function verifier(titre: string, condition: boolean, detail?: unknown) {
  console.log(`${condition ? "ok    " : "ÉCHEC "} ${titre}`);
  if (!condition) {
    echecs++;
    if (detail !== undefined) console.log("        ", JSON.stringify(detail));
  }
}

// ── Slug ──
verifier(
  "slug : accents translittérés",
  slugifier("Croisière au Canal de Panamá") === "croisiere-au-canal-de-panama",
  slugifier("Croisière au Canal de Panamá"),
);
verifier("slug : ponctuation et espaces", slugifier("  Grand tour du Maroc !  ") === "grand-tour-du-maroc");
verifier("slug : jamais vide", slugifier("!!!") === "offre");

// ── Gras partiel ──
const seg = parseGras("Départ du **27 septembre 2026** depuis Montréal");
verifier("gras : 3 segments", seg.length === 3, seg);
verifier("gras : segment central en gras", seg[1]?.gras === true && seg[1]?.texte === "27 septembre 2026");
verifier("gras : texte nettoyé", sansGras("**A** et **B**") === "A et B");

// ── Étape 2 : les faits ──
const offre = {
  type_produit: "croisiere",
  prix_par_personne: 2599,
  occupation: "double",
  taxes_incluses: true,
  date_depart: "2026-09-27",
  date_retour: null,
  aeroport_depart: "YUL",
  aeroports_alternatifs: ["YQB"],
  devise: "CAD",
};
const extraction = {
  theme_voyage: "Canal de Panama",
  inclusions: ["Vols", "Hôtels"],
  itineraire: [{ lieu: "Seattle", pays: null }, { lieu: "Miami", pays: "États-Unis" }],
};

const f = offreVersFaitsForm(offre, extraction, null);
verifier("faits : prix repris", f.prix_par_personne === "2599", f.prix_par_personne);
verifier("faits : taxes booléen → oui", f.taxes_incluses === "oui");
verifier("faits : aéroports alternatifs joints", f.aeroports_alternatifs === "YQB");
verifier("faits : thème du voyage repris", f.theme_voyage === "Canal de Panama");
verifier("faits : itinéraire lisible", f.itineraire === "Seattle\nMiami (États-Unis)", f.itineraire);
verifier("faits : safeParse PASS", FaitsForm.safeParse(f).success);

const colonnes = faitsFormVersColonnes(f);
verifier("colonnes : prix numérique", colonnes.prix_par_personne === 2599);
verifier("colonnes : champ vide → null", colonnes.fournisseur === null);
verifier("colonnes : taxes → booléen", colonnes.taxes_incluses === true);
verifier("colonnes : alternatifs → tableau", JSON.stringify(colonnes.aeroports_alternatifs) === '["YQB"]');

const contenusFaits = faitsFormVersContenus(f);
verifier(
  "contenus (faits) : itinéraire numéroté",
  JSON.stringify(contenusFaits.itineraire) ===
    '[{"jour":1,"titre":"Seattle","texte":""},{"jour":2,"titre":"Miami (États-Unis)","texte":""}]',
  contenusFaits.itineraire,
);

const sansPrix = structuredClone(f);
sansPrix.prix_par_personne = "";
verifier("faits : prix obligatoire", !FaitsForm.safeParse(sansPrix).success);

const retourAvant = structuredClone(f);
retourAvant.date_retour = "2026-09-01";
verifier("faits : retour avant départ refusé", !FaitsForm.safeParse(retourAvant).success);

// ── Étape 3 : le visuel ──
const composition = {
  titre: "Croisière au Canal de Panama",
  bandeau: "21 JOURS DE SEATTLE À MIAMI",
  colonnes: [
    {
      entete: "",
      blocs: [{ lignes: ["Vols et hôtels inclus", "Une nuit à Seattle"] }],
      prix: { surtitre: "À partir de seulement", montant: 2599, mentions: ["/personne,", "occ. double,"] },
    },
  ],
  accroche: "Croisière de 21 jours au Canal de Panama.",
  faq: [{ q: "Combien de jours ?", r: "21 jours." }],
};

const v = compositionVersVisuelForm(composition, null, "2599");
verifier(
  "visuel : bloc = lignes séparées par un retour",
  v.colonnes[0].blocs[0].texte === "Vols et hôtels inclus\nUne nuit à Seattle",
  v.colonnes[0].blocs[0].texte,
);
verifier("visuel : thème par défaut", v.theme === "azur" && v.focale === "centre");
verifier("visuel : safeParse PASS", VisuelForm.safeParse(v).success);

const contenusVisuel = visuelFormVersContenus(v, "https://exemple/hero.jpg") as Record<string, unknown>;
const visuel = contenusVisuel.visuel as Record<string, unknown>;
verifier("contenus (visuel) : variante simple", visuel.variante === "simple");
verifier(
  "contenus (visuel) : photo hero injectée",
  JSON.stringify(visuel.photo) === '{"url":"https://exemple/hero.jpg","focale":"centre"}',
);
verifier("contenus (visuel) : entête vide → null", (visuel.colonnes as Array<Record<string, unknown>>)[0].entete === null);
verifier(
  "contenus (visuel) : bloc redécoupé en 2 lignes",
  JSON.stringify(
    ((visuel.colonnes as Array<Record<string, unknown>>)[0].blocs as Array<{ lignes: string[] }>)[0].lignes,
  ) === '["Vols et hôtels inclus","Une nuit à Seattle"]',
);

// Aller-retour complet : contenus.fr relu comme composition doit redonner le même formulaire.
const relu = contenusVersComposition(contenusVisuel);
const v2 = compositionVersVisuelForm(relu, visuel as never, "2599");
verifier("visuel : aller-retour stable (titre)", v2.titre === v.titre);
verifier("visuel : aller-retour stable (blocs)", v2.colonnes[0].blocs[0].texte === v.colonnes[0].blocs[0].texte);
verifier("visuel : aller-retour stable (accroche)", v2.accroche === v.accroche);

const trop = structuredClone(v);
trop.titre = "Un titre beaucoup trop long pour le gabarit du post social";
verifier("visuel : titre trop long refusé", !VisuelForm.safeParse(trop).success);

const troisLignes = structuredClone(v);
troisLignes.colonnes[0].blocs[0].texte = "a\nb\nc";
verifier("visuel : bloc de 3 lignes refusé", !VisuelForm.safeParse(troisLignes).success);

console.log(echecs === 0 ? "\nTout est vert." : `\n${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
