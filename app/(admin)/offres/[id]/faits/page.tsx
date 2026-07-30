import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { offreVersFaitsForm } from "@/lib/schema/formulaire";
import { EtapeFaits } from "./EtapeFaits";

// Étape 2 — les faits. Document source à gauche, faits extraits à droite.
// L'extraction se lance toute seule si elle n'a pas encore tourné (§1 : tout est
// synchrone, on affiche un indicateur de progression).

export default async function PageFaits({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: offre } = await supabase.from("offres").select("*").eq("id", id).single();
  if (!offre) notFound();

  let apercuUrl: string | null = null;
  let apercuType: "image" | "pdf" | "html" | null = null;
  if (offre.source_fichier_url) {
    const { data: signed } = await supabase.storage
      .from("documents")
      .createSignedUrl(offre.source_fichier_url, 3600);
    apercuUrl = signed?.signedUrl ?? null;
    const p = String(offre.source_fichier_url).toLowerCase();
    apercuType = p.endsWith(".pdf") ? "pdf" : p.endsWith(".html") ? "html" : "image";
  }

  const brute = (offre.extraction_brute as Record<string, unknown> | null) ?? {};
  const extraction = (brute.extraction as Record<string, unknown> | null) ?? {};
  const erreurExtraction = (extraction.erreur as string | undefined) ?? null;
  const fr = ((offre.contenus as Record<string, unknown> | null)?.fr ?? null) as Record<
    string,
    unknown
  > | null;

  const defauts = offreVersFaitsForm(offre as Record<string, unknown>, extraction, fr);

  return (
    <EtapeFaits
      offreId={id}
      defauts={defauts}
      aDesFaits={offre.prix_par_personne != null}
      erreurExtraction={erreurExtraction}
      source={{ url: apercuUrl, type: apercuType, lien: (offre.source_url as string) ?? null }}
      modifiable={offre.statut === "brouillon"}
    />
  );
}
