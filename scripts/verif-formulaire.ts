// Vérification à froid des fonctions pures de la phase 3 (aucun réseau, aucune
// base) : slug, gras, et l'aller-retour formulaire → contenus.fr.
// Lance : npm run test:formulaire

import {
  FormulaireOffre,
  formulaireVersColonnes,
  formulaireVersContenus,
  offreVersFormulaire,
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

// ── Aller-retour formulaire ──
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

const f = offreVersFormulaire(offre, extraction, composition, null);
verifier("formulaire : prix repris", f.faits.prix_par_personne === "2599", f.faits.prix_par_personne);
verifier("formulaire : taxes booléen → oui", f.faits.taxes_incluses === "oui");
verifier("formulaire : aéroports alternatifs joints", f.faits.aeroports_alternatifs === "YQB");
verifier("formulaire : thème du voyage repris", f.faits.theme_voyage === "Canal de Panama");
verifier(
  "formulaire : bloc = lignes séparées par un retour",
  f.texte.colonnes[0].blocs[0].texte === "Vols et hôtels inclus\nUne nuit à Seattle",
  f.texte.colonnes[0].blocs[0].texte,
);
verifier("formulaire : itinéraire lisible", f.faits.itineraire === "Seattle\nMiami (États-Unis)", f.faits.itineraire);

const parse = FormulaireOffre.safeParse(f);
verifier("formulaire : safeParse PASS", parse.success, parse.success ? null : parse.error.issues);

const colonnes = formulaireVersColonnes(f);
verifier("colonnes : prix numérique", colonnes.prix_par_personne === 2599);
verifier("colonnes : champ vide → null", colonnes.fournisseur === null);
verifier("colonnes : taxes → booléen", colonnes.taxes_incluses === true);
verifier("colonnes : alternatifs → tableau", JSON.stringify(colonnes.aeroports_alternatifs) === '["YQB"]');

const contenus = formulaireVersContenus(f, "https://exemple/hero.jpg") as Record<string, unknown>;
const visuel = contenus.visuel as Record<string, unknown>;
verifier("contenus : variante simple", visuel.variante === "simple");
verifier("contenus : photo hero injectée", JSON.stringify(visuel.photo) === '{"url":"https://exemple/hero.jpg","focale":"centre"}');
verifier("contenus : entête vide → null", (visuel.colonnes as Array<Record<string, unknown>>)[0].entete === null);
verifier(
  "contenus : bloc redécoupé en 2 lignes",
  JSON.stringify(
    ((visuel.colonnes as Array<Record<string, unknown>>)[0].blocs as Array<{ lignes: string[] }>)[0].lignes,
  ) === '["Vols et hôtels inclus","Une nuit à Seattle"]',
);
verifier("contenus : itinéraire numéroté", JSON.stringify(contenus.itineraire) === '[{"jour":1,"titre":"Seattle","texte":""},{"jour":2,"titre":"Miami (États-Unis)","texte":""}]', contenus.itineraire);

// ── Garde-fous du schéma ──
const trop = structuredClone(f);
trop.texte.titre = "Un titre beaucoup trop long pour le gabarit du post social";
verifier("schéma : titre trop long refusé", !FormulaireOffre.safeParse(trop).success);

const troisLignes = structuredClone(f);
troisLignes.texte.colonnes[0].blocs[0].texte = "a\nb\nc";
verifier("schéma : bloc de 3 lignes refusé", !FormulaireOffre.safeParse(troisLignes).success);

const retourAvant = structuredClone(f);
retourAvant.faits.date_retour = "2026-09-01";
verifier("schéma : retour avant départ refusé", !FormulaireOffre.safeParse(retourAvant).success);

const sansPrix = structuredClone(f);
sansPrix.faits.prix_par_personne = "";
verifier("schéma : prix obligatoire", !FormulaireOffre.safeParse(sansPrix).success);

console.log(echecs === 0 ? "\nTout est vert." : `\n${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
