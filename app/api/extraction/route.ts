import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extraireFaits, type SourceExtraction } from "@/lib/extraction/client";
import { nettoyerSentinelles } from "@/lib/extraction/sentinelles";
import { composerTexte, type FaitsPourComposition } from "@/lib/composition/client";

export const runtime = "nodejs"; // Buffer + SDK Anthropic
export const maxDuration = 60; // l'extraction peut prendre ~15 s

// Colonnes de faits relues pour l'Appel 2. On part des COLONNES, pas de
// extraction_brute : en phase 3 l'opérateur y aura corrigé les faits, et la
// composition doit travailler sur la version corrigée (CLAUDE.md §8).
const COLONNES_FAITS =
  "type_produit, fournisseur, destination_pays, destination_ville, date_depart, date_retour, " +
  "duree_nuits, duree_jours, prix_par_personne, devise, occupation, taxes_incluses, " +
  "prix_valide_jusqua, compagnie_aerienne, aeroport_depart, aeroports_alternatifs, " +
  "etablissement_nom, etablissement_type, etablissement_categorie, type_cabine";

// Faits qui n'ont pas de colonne dédiée : ils vivent dans extraction_brute.extraction.
const FAITS_SANS_COLONNE = [
  "formule_secondaire",
  "inclusions",
  "exclusions",
  "itineraire",
  "supplements",
  "notes",
] as const;

// POST /api/extraction  { offreId, etape?: "extraction" | "composition" }
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  let corps: { offreId?: string; etape?: string };
  try {
    corps = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  const offreId = corps.offreId;
  const etape = corps.etape ?? "extraction";
  if (!offreId) return NextResponse.json({ error: "offreId manquant." }, { status: 400 });
  if (etape !== "extraction" && etape !== "composition")
    return NextResponse.json(
      { error: "Étape inconnue : attendu « extraction » (Appel 1) ou « composition » (Appel 2)." },
      { status: 400 },
    );

  return etape === "extraction"
    ? etapeExtraction(supabase, offreId)
    : etapeComposition(supabase, offreId);
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

// ── APPEL 1 — les faits ────────────────────────────────────────────────────
async function etapeExtraction(supabase: Supabase, offreId: string) {
  const { data: offre, error } = await supabase
    .from("offres")
    .select("id, statut, source_fichier_url, extraction_brute")
    .eq("id", offreId)
    .single();
  if (error || !offre)
    return NextResponse.json({ error: "Offre introuvable." }, { status: 404 });
  if (!offre.source_fichier_url)
    return NextResponse.json({ error: "Aucun document source à extraire." }, { status: 400 });

  // Télécharger le document depuis le bucket privé (session authentifiée → RLS OK).
  const dl = await supabase.storage.from("documents").download(offre.source_fichier_url);
  if (dl.error || !dl.data)
    return NextResponse.json({ error: "Téléchargement du document échoué." }, { status: 500 });

  const buf = Buffer.from(await dl.data.arrayBuffer());
  const chemin = String(offre.source_fichier_url).toLowerCase();

  let source: SourceExtraction;
  if (chemin.endsWith(".pdf")) {
    source = { kind: "pdf", base64: buf.toString("base64") };
  } else if (chemin.endsWith(".html")) {
    source = { kind: "html", texte: buf.toString("utf8") };
  } else {
    const mediaType = chemin.endsWith(".png")
      ? "image/png"
      : chemin.endsWith(".webp")
        ? "image/webp"
        : "image/jpeg";
    source = { kind: "image", mediaType, base64: buf.toString("base64") };
  }

  const base = (offre.extraction_brute as Record<string, unknown> | null) ?? {};

  let resultat;
  try {
    resultat = await extraireFaits(source);
  } catch (e) {
    // Erreur inattendue (réseau, API). Aucune relance.
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Extraction échouée." },
      { status: 422 },
    );
  }

  // Document illisible ou faits incohérents : on stocke l'erreur dans
  // extraction_brute.extraction (sans écraser composition) et on l'affiche.
  if (!resultat.ok) {
    await supabase
      .from("offres")
      .update({ extraction_brute: { ...base, extraction: { erreur: resultat.erreur } } })
      .eq("id", offreId);
    return NextResponse.json({ error: resultat.erreur }, { status: 422 });
  }

  // Couche de conversion : "" → null et [] → null, APRÈS le parse et avant toute
  // écriture. Le modèle signale un fait absent par une sentinelle (cf. l'encadré
  // de lib/schema/offre.ts) ; la base, elle, ne connaît que NULL.
  const faits = nettoyerSentinelles(resultat.faits);

  // extraction_brute : objet à deux clés { extraction, composition }. On n'écrase
  // jamais la clé composition. On mappe la formule principale + les champs communs
  // vers les colonnes de offres ; le reste (formule_secondaire, suppléments, notes,
  // listes) reste dans extraction_brute.extraction pour la phase 3.
  const extractionBrute = { ...base, extraction: faits };

  // Après conversion, un fait absent vaut null (chaînes, listes) ou undefined
  // (nombres et booléens, simplement omis). Le `?? null` uniformise pour ne pas
  // laisser de valeur périmée sur une ré-extraction. Exceptions devise /
  // aeroport_depart : undefined = champ non envoyé dans l'UPDATE, ce qui PRÉSERVE
  // les défauts DB 'CAD' / 'YUL'.
  const maj: Record<string, unknown> = {
    type_produit: faits.type_produit ?? null,
    fournisseur: faits.fournisseur ?? null,
    destination_pays: faits.destination_pays ?? null,
    destination_ville: faits.destination_ville ?? null,
    date_depart: faits.date_depart ?? null, // "" → null : post « départs multiples »
    date_retour: faits.date_retour ?? null,
    duree_nuits: faits.duree_nuits ?? null,
    duree_jours: faits.duree_jours ?? null,
    prix_par_personne: faits.prix_par_personne,
    occupation: faits.occupation ?? null,
    taxes_incluses: faits.taxes_incluses ?? null,
    prix_valide_jusqua: faits.prix_valide_jusqua ?? null,
    compagnie_aerienne: faits.compagnie_aerienne ?? null,
    aeroports_alternatifs: faits.aeroports_alternatifs ?? null,
    etablissement_nom: faits.etablissement_nom ?? null,
    etablissement_type: faits.etablissement_type ?? null,
    etablissement_categorie: faits.etablissement_categorie ?? null,
    type_cabine: faits.type_cabine ?? null,
    lien_reservation: faits.lien_reservation ?? null,
    lien_tripadvisor: faits.lien_tripadvisor ?? null,
    lien_monarc: faits.lien_monarc ?? null,
    devise: faits.devise ?? undefined,
    aeroport_depart: faits.aeroport_depart ?? undefined,
    extraction_brute: extractionBrute,
  };

  const { error: majErr } = await supabase.from("offres").update(maj).eq("id", offreId);
  if (majErr)
    return NextResponse.json(
      { error: "Enregistrement échoué : " + majErr.message },
      { status: 500 },
    );

  return NextResponse.json({ faits });
}

// ── APPEL 2 — le texte ─────────────────────────────────────────────────────
// Rejouable seul : c'est ce que fera le bouton « régénérer le texte » de la
// phase 3. Ne touche jamais aux faits ni à extraction_brute.extraction.
async function etapeComposition(supabase: Supabase, offreId: string) {
  const { data: offre, error } = await supabase
    .from("offres")
    .select(`id, statut, extraction_brute, ${COLONNES_FAITS}`)
    .eq("id", offreId)
    .single<Record<string, unknown>>();
  if (error || !offre)
    return NextResponse.json({ error: "Offre introuvable." }, { status: 404 });

  const base = (offre.extraction_brute as Record<string, unknown> | null) ?? {};
  const extraction = (base.extraction as Record<string, unknown> | null) ?? {};

  if (offre.prix_par_personne == null)
    return NextResponse.json(
      { error: "Faits manquants : lance d'abord l'extraction (Appel 1)." },
      { status: 400 },
    );

  // Faits envoyés au modèle : les colonnes (corrigeables par l'opérateur) plus
  // les listes, qui n'ont pas de colonne dédiée.
  const faits: FaitsPourComposition = {};
  for (const [cle, valeur] of Object.entries(offre)) {
    if (cle === "id" || cle === "statut" || cle === "extraction_brute") continue;
    if (valeur !== null && valeur !== undefined) faits[cle] = valeur;
  }
  for (const cle of FAITS_SANS_COLONNE) {
    const valeur = extraction[cle];
    if (valeur !== null && valeur !== undefined) faits[cle] = valeur;
  }

  let resultat;
  try {
    resultat = await composerTexte(faits);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Composition échouée." },
      { status: 422 },
    );
  }

  if (!resultat.ok) {
    await supabase
      .from("offres")
      .update({ extraction_brute: { ...base, composition: { erreur: resultat.erreur } } })
      .eq("id", offreId);
    return NextResponse.json({ error: resultat.erreur }, { status: 422 });
  }

  // extraction_brute.composition : sortie brute de l'Appel 2, jamais écrasée par
  // l'Appel 1. La version éditée par l'opérateur ira dans contenus (phase 3).
  const { error: majErr } = await supabase
    .from("offres")
    .update({ extraction_brute: { ...base, composition: resultat.composition } })
    .eq("id", offreId);
  if (majErr)
    return NextResponse.json(
      { error: "Enregistrement échoué : " + majErr.message },
      { status: 500 },
    );

  return NextResponse.json({ composition: resultat.composition, relance: resultat.relance });
}
