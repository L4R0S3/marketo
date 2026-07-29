import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";

type OffreListe = {
  id: string;
  slug: string;
  statut: string;
  destination_pays: string | null;
  prix_par_personne: number | null;
  cree_le: string;
};

export default async function OffresPage() {
  const supabase = await createClient();
  const { data: offres, error } = await supabase
    .from("offres")
    .select("id, slug, statut, destination_pays, prix_par_personne, cree_le")
    .order("cree_le", { ascending: false })
    .returns<OffreListe[]>();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Offres</h1>
        <Button asChild size="sm">
          <Link href="/offres/nouvelle">Nouvelle offre</Link>
        </Button>
      </div>

      {error && (
        <p className="text-sm text-red-600">
          Erreur de chargement : {error.message}
        </p>
      )}

      {!error && (!offres || offres.length === 0) && (
        <p className="text-sm text-muted-foreground">
          Aucune offre pour le moment.
        </p>
      )}

      {offres && offres.length > 0 && (
        <ul className="flex flex-col divide-y border rounded-md">
          {offres.map((offre) => (
            <li key={offre.id}>
              <Link
                href={`/offres/${offre.id}`}
                className="flex items-center justify-between px-4 py-3 text-sm hover:bg-muted"
              >
                <span>{offre.destination_pays ?? offre.slug}</span>
                <span className="text-muted-foreground">{offre.statut}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
