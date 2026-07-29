import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extraireFaits, type SourceExtraction } from "@/lib/extraction/client";

export const runtime = "nodejs"; // Buffer + SDK Anthropic
export const maxDuration = 60; // l'extraction peut prendre ~15 s

// POST /api/extraction  { offreId, etape?: "extraction" }
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
  if (etape !== "extraction")
    return NextResponse.json(
      { error: "Seule l'étape « extraction » (Appel 1) est disponible." },
      { status: 400 },
    );

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

  const faits = resultat.faits;

  // extraction_brute : objet à deux clés { extraction, composition }. On n'écrase
  // jamais la clé composition. On mappe la formule principale + les champs communs
  // vers les colonnes de offres ; le reste (formule_secondaire, suppléments, notes,
  // listes) reste dans extraction_brute.extraction pour la phase 3.
  const extractionBrute = { ...base, extraction: faits };

  // Les faits absents sont undefined (schéma .optional()). On pose un null explicite
  // en colonne (?? null) pour ne pas laisser de valeur périmée sur une ré-extraction.
  // Exceptions devise / aeroport_depart : on laisse undefined (champ non envoyé dans
  // l'UPDATE) pour PRÉSERVER les défauts DB 'CAD' / 'YUL'.
  const maj: Record<string, unknown> = {
    type_produit: faits.type_produit ?? null,
    fournisseur: faits.fournisseur ?? null,
    destination_pays: faits.destination_pays ?? null,
    destination_ville: faits.destination_ville ?? null,
    date_depart: faits.date_depart,
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
