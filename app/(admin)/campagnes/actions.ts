"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Actions des campagnes. Une campagne = un envoi Mailchimp : une offre vedette
// (bloc « vedette ») et des offres secondaires ordonnées (blocs « condensé »).

type Resultat = { error: string } | { ok: true };

async function session() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? supabase : null;
}

// Action de formulaire : elle doit rendre void, d'où les exceptions plutôt que
// des objets d'erreur (même convention que supprimerOffre).
export async function creerCampagne(formData: FormData): Promise<void> {
  const nom = String(formData.get("nom") ?? "").trim();
  if (!nom) throw new Error("Donne un nom à la campagne.");

  const supabase = await session();
  if (!supabase) throw new Error("Session expirée.");

  const { data, error } = await supabase
    .from("campagnes")
    .insert({ nom, statut: "brouillon" })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Création échouée : ${error?.message ?? "inconnu"}`);

  revalidatePath("/campagnes");
  redirect(`/campagnes/${data.id}`);
}

export async function renommerCampagne(campagneId: string, nom: string): Promise<Resultat> {
  const supabase = await session();
  if (!supabase) return { error: "Session expirée." };
  if (!nom.trim()) return { error: "Le nom ne peut pas être vide." };

  const { error } = await supabase
    .from("campagnes")
    .update({ nom: nom.trim() })
    .eq("id", campagneId);
  if (error) return { error: error.message };

  revalidatePath(`/campagnes/${campagneId}`);
  return { ok: true };
}

// L'offre vedette est celle qui ouvre le courriel, en variante « vedette ».
export async function definirVedette(
  campagneId: string,
  offreId: string | null,
): Promise<Resultat> {
  const supabase = await session();
  if (!supabase) return { error: "Session expirée." };

  const { error } = await supabase
    .from("campagnes")
    .update({ offre_vedette: offreId })
    .eq("id", campagneId);
  if (error) return { error: error.message };

  // Une offre vedette n'a pas à figurer aussi dans les secondaires.
  if (offreId)
    await supabase
      .from("campagne_offres")
      .delete()
      .eq("campagne_id", campagneId)
      .eq("offre_id", offreId);

  revalidatePath(`/campagnes/${campagneId}`);
  return { ok: true };
}

export async function ajouterOffre(campagneId: string, offreId: string): Promise<Resultat> {
  const supabase = await session();
  if (!supabase) return { error: "Session expirée." };

  const { data: dernier } = await supabase
    .from("campagne_offres")
    .select("ordre")
    .eq("campagne_id", campagneId)
    .order("ordre", { ascending: false })
    .limit(1);
  const ordre = dernier?.length ? (dernier[0].ordre ?? 0) + 1 : 0;

  const { error } = await supabase
    .from("campagne_offres")
    .insert({ campagne_id: campagneId, offre_id: offreId, ordre });
  if (error) return { error: error.message };

  revalidatePath(`/campagnes/${campagneId}`);
  return { ok: true };
}

export async function retirerOffre(campagneId: string, offreId: string): Promise<Resultat> {
  const supabase = await session();
  if (!supabase) return { error: "Session expirée." };

  const { error } = await supabase
    .from("campagne_offres")
    .delete()
    .eq("campagne_id", campagneId)
    .eq("offre_id", offreId);
  if (error) return { error: error.message };

  revalidatePath(`/campagnes/${campagneId}`);
  return { ok: true };
}

// Réordonnancement : on renumérote toute la liste, c'est le seul moyen sûr avec
// une clé primaire composée (campagne_id, offre_id) et des ordres qui peuvent
// avoir des trous.
export async function reordonner(campagneId: string, offreIds: string[]): Promise<Resultat> {
  const supabase = await session();
  if (!supabase) return { error: "Session expirée." };

  for (let i = 0; i < offreIds.length; i++) {
    const { error } = await supabase
      .from("campagne_offres")
      .update({ ordre: i })
      .eq("campagne_id", campagneId)
      .eq("offre_id", offreIds[i]);
    if (error) return { error: error.message };
  }

  revalidatePath(`/campagnes/${campagneId}`);
  return { ok: true };
}

export async function supprimerCampagne(formData: FormData): Promise<void> {
  const campagneId = String(formData.get("campagneId") ?? "");
  const supabase = await session();
  if (!supabase || !campagneId) return;

  await supabase.from("campagnes").delete().eq("id", campagneId);
  revalidatePath("/campagnes");
  redirect("/campagnes");
}
