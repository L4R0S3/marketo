import Link from "next/link";
import { Megaphone } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { creerCampagne } from "./actions";

// Liste des campagnes. Une campagne correspond à un envoi Mailchimp.

type Campagne = {
  id: string;
  nom: string;
  statut: string | null;
  date_envoi: string | null;
  cree_le: string;
  offre_vedette: string | null;
};

const dateCourte = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-CA", { day: "2-digit", month: "short", year: "numeric" });

export default async function CampagnesPage() {
  const supabase = await createClient();
  const { data: campagnes } = await supabase
    .from("campagnes")
    .select("id, nom, statut, date_envoi, cree_le, offre_vedette")
    .order("cree_le", { ascending: false })
    .returns<Campagne[]>();

  const liste = campagnes ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Campagnes</h1>
        <p className="text-sm text-muted-foreground">
          Un envoi courriel regroupe une offre vedette et des offres secondaires.
        </p>
      </div>

      <Card>
        <CardContent>
          <form action={creerCampagne} className="flex flex-wrap items-end gap-3">
            <div className="flex min-w-64 flex-1 flex-col gap-1">
              <label htmlFor="nom" className="text-sm font-medium">
                Nouvelle campagne
              </label>
              <Input id="nom" name="nom" placeholder="Envoi du 5 août" required />
            </div>
            <Button type="submit">Créer</Button>
          </form>
        </CardContent>
      </Card>

      {liste.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <Megaphone className="size-6 text-muted-foreground" />
            </div>
            <p className="font-medium">Aucune campagne</p>
            <p className="text-sm text-muted-foreground">
              Crée une campagne, choisis l&apos;offre vedette, ajoute les autres, copie le HTML.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Nom</TableHead>
                <TableHead>Vedette</TableHead>
                <TableHead className="text-right">Créée le</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {liste.map((c) => (
                <TableRow key={c.id} className="cursor-pointer">
                  <TableCell className="font-medium">
                    <Link href={`/campagnes/${c.id}`} className="block py-1">
                      {c.nom}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <Link href={`/campagnes/${c.id}`} className="block py-1">
                      {c.offre_vedette ? "choisie" : "à choisir"}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    <Link href={`/campagnes/${c.id}`} className="block py-1">
                      {dateCourte(c.cree_le)}
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
