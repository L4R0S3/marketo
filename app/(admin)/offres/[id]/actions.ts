"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  FaitsForm,
  VisuelForm,
  faitsFormVersColonnes,
  faitsFormVersContenus,
  visuelFormVersContenus,
  slugifier,
} from "@/lib/schema/formulaire";

export type Resultat = { error: string } | { ok: true; message: string };

// Le serveur REVALIDE toujours : le navigateur peut mentir, et une erreur de prix
// sur une offre de voyage a un coût réel (CLAUDE.md §11).
function premierProbleme(issues: { path: PropertyKey[]; message: string }[]): string {
  const p = issues[0];
  return `Formulaire invalide — ${p.path.join(".")} : ${p.message}`;
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function session(): Promise<Supabase | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? supabase : null;
}

// URL publique de la photo hero : le gabarit et la landing page en ont besoin.
async function urlHero(supabase: Supabase, offreId: string): Promise<string | null> {
  const { data } = await supabase
    .from("photos")
    .select("url")
    .eq("offre_id", offreId)
    .eq("role", "hero")
    .maybeSingle();
  if (!data?.url) return null;
  return supabase.storage.from("photos").getPublicUrl(data.url as string).data.publicUrl;
}

// Fusion dans contenus.fr : chaque étape n'écrit que la part qui lui appartient,
// sans écraser ce que l'autre y a mis.
async function fusionnerContenus(
  supabase: Supabase,
  offreId: string,
  part: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const { data } = await supabase.from("offres").select("contenus").eq("id", offreId).single();
  const contenus = (data?.contenus as Record<string, unknown> | null) ?? { fr: {}, en: null };
  const fr = (contenus.fr as Record<string, unknown> | null) ?? {};
  return { ...contenus, fr: { ...fr, ...part } };
}

// ── Étape 2 : les faits ────────────────────────────────────────────────────
export async function enregistrerFaits(offreId: string, donnees: unknown): Promise<Resultat> {
  const v = FaitsForm.safeParse(donnees);
  if (!v.success) return { error: premierProbleme(v.error.issues) };

  const supabase = await session();
  if (!supabase) return { error: "Session expirée." };

  const maj = {
    ...faitsFormVersColonnes(v.data),
    contenus: await fusionnerContenus(supabase, offreId, faitsFormVersContenus(v.data)),
    modifie_le: new Date().toISOString(),
  };

  const { error } = await supabase.from("offres").update(maj).eq("id", offreId);
  if (error) return { error: `Enregistrement échoué : ${error.message}` };

  revalidatePath(`/offres/${offreId}`, "layout");
  return { ok: true, message: "Faits enregistrés." };
}

// ── Étape 3 : le visuel ────────────────────────────────────────────────────
export async function enregistrerVisuel(offreId: string, donnees: unknown): Promise<Resultat> {
  const v = VisuelForm.safeParse(donnees);
  if (!v.success) return { error: premierProbleme(v.error.issues) };

  const supabase = await session();
  if (!supabase) return { error: "Session expirée." };

  const hero = (await urlHero(supabase, offreId)) ?? "";
  const maj = {
    contenus: await fusionnerContenus(supabase, offreId, visuelFormVersContenus(v.data, hero)),
    modifie_le: new Date().toISOString(),
  };

  const { error } = await supabase.from("offres").update(maj).eq("id", offreId);
  if (error) return { error: `Enregistrement échoué : ${error.message}` };

  revalidatePath(`/offres/${offreId}`, "layout");
  return { ok: true, message: "Visuel enregistré." };
}

// ── Passage au statut validée ──────────────────────────────────────────────
// Seul point d'entrée du statut « validee » : il vérifie ce qu'aucune sortie ne
// pourra rattraper ensuite (prix, titre, photo hero).
export async function validerOffre(offreId: string, donnees: unknown): Promise<Resultat> {
  const v = VisuelForm.safeParse(donnees);
  if (!v.success) return { error: premierProbleme(v.error.issues) };

  const supabase = await session();
  if (!supabase) return { error: "Session expirée." };

  const { data: offre } = await supabase
    .from("offres")
    .select("statut, slug, slug_gele, prix_par_personne")
    .eq("id", offreId)
    .single();
  if (!offre) return { error: "Offre introuvable." };
  if (offre.statut === "publiee" || offre.statut === "archivee")
    return { error: `Une offre ${offre.statut} ne repasse pas par la validation.` };
  if (offre.prix_par_personne == null)
    return { error: "Aucun prix enregistré : reviens à l'étape des faits." };

  const hero = await urlHero(supabase, offreId);
  if (!hero)
    return {
      error:
        "Aucune photo hero : le post social en a besoin. Téléverse une photo et désigne-la comme hero.",
    };

  // Slug régénéré côté app depuis le titre validé, sauf s'il est gelé (une offre
  // déjà publiée garde son URL — le trigger gel_slug le refuserait de toute façon).
  let slug = offre.slug as string;
  if (!offre.slug_gele) {
    const base = slugifier(v.data.titre);
    slug = base;
    for (let n = 2; n < 50; n++) {
      const { data: collision } = await supabase
        .from("offres")
        .select("id")
        .eq("slug", slug)
        .neq("id", offreId)
        .maybeSingle();
      if (!collision) break;
      slug = `${base}-${n}`;
    }
  }

  const maj = {
    contenus: await fusionnerContenus(supabase, offreId, visuelFormVersContenus(v.data, hero)),
    slug,
    statut: "validee",
    modifie_le: new Date().toISOString(),
  };

  const { error } = await supabase.from("offres").update(maj).eq("id", offreId);
  if (error) return { error: `Validation échouée : ${error.message}` };

  revalidatePath(`/offres/${offreId}`, "layout");
  revalidatePath("/offres");
  return { ok: true, message: "Offre validée." };
}

// ── Retour en brouillon ────────────────────────────────────────────────────
export async function repasserEnBrouillon(offreId: string): Promise<Resultat> {
  const supabase = await session();
  if (!supabase) return { error: "Session expirée." };

  const { data: offre } = await supabase
    .from("offres")
    .select("statut")
    .eq("id", offreId)
    .single();
  if (!offre) return { error: "Offre introuvable." };
  if (offre.statut !== "validee")
    return { error: "Seule une offre validée peut repasser en brouillon." };

  const { error } = await supabase
    .from("offres")
    .update({ statut: "brouillon", modifie_le: new Date().toISOString() })
    .eq("id", offreId);
  if (error) return { error: `Échec : ${error.message}` };

  revalidatePath(`/offres/${offreId}`, "layout");
  revalidatePath("/offres");
  return { ok: true, message: "Repassée en brouillon." };
}
