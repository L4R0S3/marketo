import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// /offres/[id] n'affiche rien : le flux est découpé en étapes, on renvoie
// l'opérateur là où son offre en est.

export default async function OffrePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: offre } = await supabase
    .from("offres")
    .select("statut, prix_par_personne")
    .eq("id", id)
    .single();
  if (!offre) notFound();

  if (offre.statut !== "brouillon") redirect(`/offres/${id}/sorties`);
  if (offre.prix_par_personne != null) redirect(`/offres/${id}/visuel`);
  redirect(`/offres/${id}/faits`);
}
