import { createClient } from "@/lib/supabase/server";
import { compiler } from "./compiler";
import { offreVersBloc, type BlocOffre } from "./donnees";
import { blocSeulMjml, campagneMjml, type OffreCampagne } from "./campagne.mjml";
import type { VarianteBloc } from "./bloc.mjml";

// Point d'entrée serveur du gabarit courriel : lit l'offre, construit le bloc,
// compile. Utilisé par l'étape Sorties (un bloc) et par la page campagne
// (le courriel complet).

const CHAMPS =
  "id, slug, statut, destination_pays, destination_ville, date_depart, date_retour, " +
  "duree_nuits, duree_jours, prix_par_personne, prix_avant_rabais, devise, occupation, " +
  "taxes_incluses, compagnie_aerienne, aeroport_depart, etablissement_nom, " +
  "etablissement_categorie, type_cabine, contenus";

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function lireBloc(supabase: Supabase, offreId: string): Promise<BlocOffre | null> {
  const { data: offre } = await supabase
    .from("offres")
    .select(CHAMPS)
    .eq("id", offreId)
    .single<Record<string, unknown>>();
  if (!offre) return null;

  const { data: photos } = await supabase
    .from("photos")
    .select("url, role, ordre")
    .eq("offre_id", offreId)
    .order("ordre");

  return offreVersBloc(offre, (photos ?? []) as { url: string; role: string }[]);
}

/** Le bloc d'une seule offre, tel qu'il apparaîtra dans le courriel. */
export async function htmlBlocOffre(
  offreId: string,
  variante: VarianteBloc = "vedette",
): Promise<{ html: string; avertissements: string[] } | null> {
  const supabase = await createClient();
  const bloc = await lireBloc(supabase, offreId);
  if (!bloc) return null;
  return compiler(blocSeulMjml(bloc, variante));
}

/** Le courriel complet d'une campagne : vedette en premier, puis les autres. */
export async function htmlCampagne(
  offres: { id: string; variante: VarianteBloc }[],
  titreEnvoi?: string,
): Promise<{ html: string; avertissements: string[] }> {
  const supabase = await createClient();
  const blocs: OffreCampagne[] = [];
  for (const o of offres) {
    const bloc = await lireBloc(supabase, o.id);
    if (bloc) blocs.push({ offre: bloc, variante: o.variante });
  }
  return compiler(campagneMjml(blocs, titreEnvoi));
}
