import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EtapeSorties } from "./EtapeSorties";

// Étape 4 — les sorties. Phase 4 = le post Facebook, et rien d'autre : le PNG et
// le texte de publication. Le bloc courriel et la landing page viendront plus tard.

export default async function PageSorties({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: offre } = await supabase
    .from("offres")
    .select("statut, slug, contenus")
    .eq("id", id)
    .single();
  if (!offre) notFound();

  // Garde d'interface — la route /api/og la refait côté serveur : aucune sortie
  // ne se génère depuis un brouillon.
  if (offre.statut === "brouillon") redirect(`/offres/${id}/visuel`);

  const fr = ((offre.contenus as Record<string, unknown> | null)?.fr ?? null) as Record<
    string,
    unknown
  > | null;

  return (
    <EtapeSorties
      offreId={id}
      slug={offre.slug as string}
      titre={(fr?.titre as string) ?? ""}
      accroche={(fr?.accroche as string) ?? ""}
    />
  );
}
