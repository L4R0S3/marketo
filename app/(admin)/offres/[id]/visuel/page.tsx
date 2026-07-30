import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  compositionVersVisuelForm,
  contenusVersComposition,
} from "@/lib/schema/formulaire";
import type { CompositionT } from "@/lib/composition/schema";
import type { PostVisuelT } from "@/lib/templates/social/schema";
import { EtapeVisuel } from "./EtapeVisuel";

// Étape 3 — le visuel. Aperçu en grand à gauche, contrôles à droite.

export default async function PageVisuel({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: offre } = await supabase.from("offres").select("*").eq("id", id).single();
  if (!offre) notFound();
  // Sans faits, il n'y a rien à composer : on renvoie à l'étape précédente.
  if (offre.prix_par_personne == null) redirect(`/offres/${id}/faits`);

  const { data: photosBrutes } = await supabase
    .from("photos")
    .select("id, url, ordre, role")
    .eq("offre_id", id)
    .order("ordre");
  const photos = (photosBrutes ?? []).map((p) => ({
    id: p.id as string,
    role: p.role as string,
    publicUrl: supabase.storage.from("photos").getPublicUrl(p.url as string).data.publicUrl,
  }));
  const heroUrl = photos.find((p) => p.role === "hero")?.publicUrl ?? null;

  const brute = (offre.extraction_brute as Record<string, unknown> | null) ?? {};
  const compositionBrute = brute.composition as Record<string, unknown> | null;
  const erreurComposition = (compositionBrute?.erreur as string | undefined) ?? null;
  const fr = ((offre.contenus as Record<string, unknown> | null)?.fr ?? null) as Record<
    string,
    unknown
  > | null;

  // Ce que l'opérateur a déjà édité prime sur la sortie brute du modèle.
  const edite = fr ? contenusVersComposition(fr) : null;
  const composition: CompositionT | null =
    edite ??
    (compositionBrute && !erreurComposition ? (compositionBrute as unknown as CompositionT) : null);

  const defauts = compositionVersVisuelForm(
    composition,
    (fr?.visuel as PostVisuelT | undefined) ?? null,
    String(offre.prix_par_personne ?? ""),
  );

  return (
    <EtapeVisuel
      offreId={id}
      defauts={defauts}
      photos={photos}
      heroUrl={heroUrl}
      aDuTexte={composition != null}
      erreurComposition={erreurComposition}
      statut={offre.statut as string}
    />
  );
}
