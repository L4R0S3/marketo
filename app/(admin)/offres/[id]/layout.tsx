import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { StatutBadge } from "@/components/StatutBadge";
import { Stepper } from "./Stepper";
import { MenuOffre } from "./MenuOffre";

// En-tête commune aux trois étapes : identité de l'offre, progression, actions
// rares repliées dans un menu. Les étapes elles-mêmes sont les enfants.

export default async function OffreLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: offre } = await supabase
    .from("offres")
    .select("id, slug, statut, prix_par_personne, contenus, destination_pays")
    .eq("id", id)
    .single();
  if (!offre) notFound();

  const fr = ((offre.contenus as Record<string, unknown> | null)?.fr ?? null) as Record<
    string,
    unknown
  > | null;
  const titre =
    (fr?.titre as string) || (offre.destination_pays as string) || "Offre sans titre";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{titre}</h1>
            <div className="flex items-center gap-2 text-sm">
              <StatutBadge statut={offre.statut as string} />
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                {offre.slug}
              </code>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button asChild variant="ghost" size="sm">
              <Link href="/offres">
                <ArrowLeft className="size-4" />
                Retour à la liste
              </Link>
            </Button>
            <MenuOffre offreId={id} statut={offre.statut as string} />
          </div>
        </div>

        <Stepper
          offreId={id}
          aDesFaits={offre.prix_par_personne != null}
          estValidee={offre.statut !== "brouillon"}
        />
      </div>

      {children}
    </div>
  );
}
