import Link from "next/link";
import { FileUp, Inbox } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatutBadge } from "@/components/StatutBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type OffreListe = {
  id: string;
  slug: string;
  statut: string;
  destination_pays: string | null;
  prix_par_personne: number | null;
  cree_le: string;
  contenus: { fr?: { titre?: string } } | null;
};

const dateCourte = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-CA", { day: "2-digit", month: "short", year: "numeric" });

export default async function OffresPage() {
  const supabase = await createClient();
  const { data: offres, error } = await supabase
    .from("offres")
    .select("id, slug, statut, destination_pays, prix_par_personne, cree_le, contenus")
    .order("cree_le", { ascending: false })
    .returns<OffreListe[]>();

  const vide = !error && (!offres || offres.length === 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Offres</h1>
          <p className="text-sm text-muted-foreground">
            Chaque offre part d&apos;un document déposé et finit en post, courriel et page.
          </p>
        </div>
        <Button asChild>
          <Link href="/offres/nouvelle">
            <FileUp className="size-4" />
            Nouvelle offre
          </Link>
        </Button>
      </div>

      {error && (
        <Card>
          <CardContent className="text-sm text-destructive">
            Erreur de chargement : {error.message}
          </CardContent>
        </Card>
      )}

      {vide && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <Inbox className="size-6 text-muted-foreground" />
            </div>
            <div className="flex flex-col gap-1">
              <p className="font-medium">Aucune offre</p>
              <p className="text-sm text-muted-foreground">
                Dépose une capture Sirev, un PDF fournisseur ou une URL pour commencer.
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href="/offres/nouvelle">Déposer une offre</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {offres && offres.length > 0 && (
        <Card className="overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Titre</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead className="text-right">Prix</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Créée le</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {offres.map((offre) => (
                <TableRow key={offre.id} className="cursor-pointer">
                  {/* Le lien couvre chaque cellule : la ligne entière est cliquable
                      tout en restant une vraie navigation (clic milieu, ⌘-clic). */}
                  <TableCell className="font-medium">
                    <Link href={`/offres/${offre.id}`} className="block py-1">
                      {offre.contenus?.fr?.titre || (
                        <span className="text-muted-foreground">{offre.slug}</span>
                      )}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <Link href={`/offres/${offre.id}`} className="block py-1">
                      {offre.destination_pays ?? "—"}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <Link href={`/offres/${offre.id}`} className="block py-1">
                      {offre.prix_par_personne != null ? `${offre.prix_par_personne} $` : "—"}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link href={`/offres/${offre.id}`} className="block py-1">
                      <StatutBadge statut={offre.statut} />
                    </Link>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    <Link href={`/offres/${offre.id}`} className="block py-1">
                      {dateCourte(offre.cree_le)}
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
