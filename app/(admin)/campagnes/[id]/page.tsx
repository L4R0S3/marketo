import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { htmlCampagne } from "@/lib/templates/email";
import { Button } from "@/components/ui/button";
import { CompositionCampagne } from "./CompositionCampagne";

// Composition d'une campagne : l'offre vedette, les offres secondaires ordonnées,
// et le courriel assemblé, prêt à coller dans Mailchimp.
// Seules les offres validées ou publiées sont éligibles — le courriel est une
// sortie, et aucune sortie ne part d'un brouillon (CLAUDE.md §4).

export type OffreEligible = {
  id: string;
  slug: string;
  statut: string;
  titre: string;
  destination: string | null;
  prix: number | null;
};

export default async function PageCampagne({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: campagne } = await supabase
    .from("campagnes")
    .select("id, nom, statut, offre_vedette")
    .eq("id", id)
    .single();
  if (!campagne) notFound();

  const { data: brutes } = await supabase
    .from("offres")
    .select("id, slug, statut, destination_pays, prix_par_personne, contenus")
    .in("statut", ["validee", "publiee"])
    .order("modifie_le", { ascending: false, nullsFirst: false });

  const eligibles: OffreEligible[] = (brutes ?? []).map((o) => {
    const fr = ((o.contenus as Record<string, unknown> | null)?.fr ?? {}) as Record<
      string,
      unknown
    >;
    return {
      id: o.id as string,
      slug: o.slug as string,
      statut: o.statut as string,
      titre: (fr.titre as string) || (o.slug as string),
      destination: (o.destination_pays as string) ?? null,
      prix: (o.prix_par_personne as number) ?? null,
    };
  });

  const { data: liens } = await supabase
    .from("campagne_offres")
    .select("offre_id, ordre")
    .eq("campagne_id", id)
    .order("ordre");

  const secondaires = (liens ?? [])
    .map((l) => eligibles.find((o) => o.id === l.offre_id))
    .filter(Boolean) as OffreEligible[];
  const vedette = eligibles.find((o) => o.id === campagne.offre_vedette) ?? null;

  // Le courriel complet : vedette d'abord, puis les secondaires dans leur ordre.
  const courriel = await htmlCampagne(
    [
      ...(vedette ? [{ id: vedette.id, variante: "vedette" as const }] : []),
      ...secondaires.map((o) => ({ id: o.id, variante: "condense" as const })),
    ],
    campagne.nom as string,
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{campagne.nom}</h1>
          <p className="text-sm text-muted-foreground">
            {vedette ? "1 offre vedette" : "aucune offre vedette"} ·{" "}
            {secondaires.length} offre{secondaires.length > 1 ? "s" : ""} secondaire
            {secondaires.length > 1 ? "s" : ""}
          </p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/campagnes">
            <ArrowLeft className="size-4" />
            Retour aux campagnes
          </Link>
        </Button>
      </div>

      <CompositionCampagne
        campagneId={id}
        nom={campagne.nom as string}
        vedette={vedette}
        secondaires={secondaires}
        eligibles={eligibles}
        courrielHtml={courriel.html}
      />
    </div>
  );
}
