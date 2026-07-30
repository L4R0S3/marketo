import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Stepper } from "./Stepper";
import { MenuOffre } from "./MenuOffre";

// En-tête commune aux trois étapes : identité de l'offre, progression, actions
// rares repliées dans un menu discret. Les étapes elles-mêmes sont les enfants.

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
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">{titre}</h1>
          <p className="text-sm text-muted-foreground">
            {offre.slug} ·{" "}
            <span className="rounded bg-muted px-1.5 py-0.5">{offre.statut}</span>
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Link href="/offres" className="text-sm text-muted-foreground underline">
            Retour à la liste
          </Link>
          <MenuOffre offreId={id} statut={offre.statut as string} />
        </div>
      </div>

      <Stepper
        offreId={id}
        aDesFaits={offre.prix_par_personne != null}
        estValidee={offre.statut !== "brouillon"}
      />

      {children}
    </div>
  );
}
