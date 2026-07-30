import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { htmlBlocOffre } from "@/lib/templates/email";
import { SITE_URL } from "@/lib/marque";
import { EtapeSorties } from "./EtapeSorties";

// Étape 4 — les sorties. Trois sections : le post social, le bloc courriel et la
// landing page. Le HTML courriel est compilé ici, côté serveur : MJML n'a rien à
// faire dans le navigateur.

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

  const courriel = await htmlBlocOffre(id, "vedette");

  return (
    <EtapeSorties
      offreId={id}
      slug={offre.slug as string}
      titre={(fr?.titre as string) ?? ""}
      accroche={(fr?.accroche as string) ?? ""}
      courrielHtml={courriel?.html ?? null}
      publiee={offre.statut === "publiee"}
      urlPublique={`${SITE_URL}/voyage/${offre.slug as string}`}
    />
  );
}
