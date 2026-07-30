"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  FormulaireOffre,
  formulaireVersColonnes,
  formulaireVersContenus,
  slugifier,
  type FormulaireOffreT,
} from "@/lib/schema/formulaire";

type Resultat = { error: string } | { ok: true; message: string };

// Le serveur REVALIDE le formulaire : le navigateur peut mentir, et une erreur
// de prix sur une offre de voyage a un coût réel (CLAUDE.md §11).
function relire(donnees: unknown): { f: FormulaireOffreT } | { error: string } {
  const v = FormulaireOffre.safeParse(donnees);
  if (!v.success) {
    const premier = v.error.issues[0];
    return {
      error: `Formulaire invalide — ${premier.path.join(".")} : ${premier.message}`,
    };
  }
  return { f: v.data };
}

// URL publique de la photo hero. Le gabarit et la landing page en ont besoin ;
// sans elle, aucune sortie n'est générable.
async function urlHero(
  supabase: Awaited<ReturnType<typeof createClient>>,
  offreId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("photos")
    .select("url")
    .eq("offre_id", offreId)
    .eq("role", "hero")
    .maybeSingle();
  if (!data?.url) return null;
  return supabase.storage.from("photos").getPublicUrl(data.url as string).data.publicUrl;
}

// ── Enregistrer sans changer de statut ─────────────────────────────────────
export async function enregistrerOffre(
  offreId: string,
  donnees: unknown,
): Promise<Resultat> {
  const lu = relire(donnees);
  if ("error" in lu) return lu;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée." };

  const { data: offre } = await supabase
    .from("offres")
    .select("statut, contenus")
    .eq("id", offreId)
    .single();
  if (!offre) return { error: "Offre introuvable." };

  const hero = (await urlHero(supabase, offreId)) ?? "";
  const contenus = (offre.contenus as Record<string, unknown> | null) ?? { fr: {}, en: null };

  const maj = {
    ...formulaireVersColonnes(lu.f),
    contenus: { ...contenus, fr: formulaireVersContenus(lu.f, hero) },
    modifie_le: new Date().toISOString(),
  };

  const { error } = await supabase.from("offres").update(maj).eq("id", offreId);
  if (error) return { error: `Enregistrement échoué : ${error.message}` };

  revalidatePath(`/offres/${offreId}`);
  return { ok: true, message: "Enregistré." };
}

// ── Passage au statut validée ──────────────────────────────────────────────
// C'est le seul point d'entrée du statut « validee » : il vérifie ce qu'aucune
// sortie ne pourra rattraper ensuite (prix, titre, photo hero).
export async function validerOffre(
  offreId: string,
  donnees: unknown,
): Promise<Resultat> {
  const lu = relire(donnees);
  if ("error" in lu) return lu;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée." };

  const { data: offre } = await supabase
    .from("offres")
    .select("statut, slug, slug_gele, contenus")
    .eq("id", offreId)
    .single();
  if (!offre) return { error: "Offre introuvable." };
  if (offre.statut === "publiee" || offre.statut === "archivee")
    return { error: `Une offre ${offre.statut} ne repasse pas par la validation.` };

  const hero = await urlHero(supabase, offreId);
  if (!hero)
    return {
      error:
        "Aucune photo hero : le post social et la landing page en ont besoin. Téléverse une photo et désigne-la comme hero.",
    };

  const contenus = (offre.contenus as Record<string, unknown> | null) ?? { fr: {}, en: null };

  // Slug régénéré côté app depuis le titre validé, sauf s'il est gelé (une offre
  // déjà publiée garde son URL — le trigger gel_slug le refuserait de toute façon).
  let slug = offre.slug as string;
  if (!offre.slug_gele) {
    const base = slugifier(lu.f.texte.titre);
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
    ...formulaireVersColonnes(lu.f),
    contenus: { ...contenus, fr: formulaireVersContenus(lu.f, hero) },
    slug,
    statut: "validee",
    modifie_le: new Date().toISOString(),
  };

  const { error } = await supabase.from("offres").update(maj).eq("id", offreId);
  if (error) return { error: `Validation échouée : ${error.message}` };

  revalidatePath(`/offres/${offreId}`);
  revalidatePath("/offres");
  return { ok: true, message: `Offre validée. URL : /voyage/${slug}` };
}

// ── Retour en brouillon ────────────────────────────────────────────────────
export async function repasserEnBrouillon(offreId: string): Promise<Resultat> {
  const supabase = await createClient();
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

  revalidatePath(`/offres/${offreId}`);
  revalidatePath("/offres");
  return { ok: true, message: "Repassée en brouillon." };
}
