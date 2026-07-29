"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// undefined = succès (l'action redirige ou revalide) ; { error } = échec affiché.
type Resultat = { error: string } | undefined;

const TYPES_IMAGE = ["image/png", "image/jpeg", "image/webp"];
const MAX_IMAGE = 10 * 1024 * 1024; // 10 Mo
const MAX_PDF = 20 * 1024 * 1024; // 20 Mo
const TIMEOUT_URL = 15_000; // 15 s
const MAX_HTML = 5 * 1024 * 1024; // garde-fou 5 Mo

function nomSur(nom: string): string {
  const n = nom.normalize("NFKD").replace(/[^\w.\-]+/g, "_");
  return (n.length > 100 ? n.slice(-100) : n) || "fichier";
}

// ── Création d'une offre depuis un fichier déposé ──────────────────────
export async function creerOffreDepuisFichier(
  formData: FormData,
): Promise<Resultat> {
  const file = formData.get("fichier");
  if (!(file instanceof File) || file.size === 0)
    return { error: "Aucun fichier reçu." };

  const estImage = TYPES_IMAGE.includes(file.type);
  const estPdf = file.type === "application/pdf";
  if (!estImage && !estPdf)
    return { error: "Type non accepté (PNG, JPG, WEBP ou PDF)." };
  if (estImage && file.size > MAX_IMAGE)
    return { error: "Image trop lourde (max 10 Mo)." };
  if (estPdf && file.size > MAX_PDF)
    return { error: "PDF trop lourd (max 20 Mo)." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée." };

  const offreId = crypto.randomUUID();
  const chemin = `${offreId}/${Date.now()}-${nomSur(file.name)}`;
  const buf = Buffer.from(await file.arrayBuffer());

  const up = await supabase.storage
    .from("documents")
    .upload(chemin, buf, { contentType: file.type, upsert: false });
  if (up.error) return { error: `Téléversement échoué : ${up.error.message}` };

  const ins = await supabase
    .from("offres")
    .insert({ id: offreId, statut: "brouillon", source_fichier_url: chemin });
  if (ins.error) {
    await supabase.storage.from("documents").remove([chemin]); // rollback
    return { error: `Création échouée : ${ins.error.message}` };
  }

  revalidatePath("/offres");
  redirect(`/offres/${offreId}`);
}

// ── Création d'une offre depuis une URL (snapshot HTML dans documents) ──
export async function creerOffreDepuisUrl(formData: FormData): Promise<Resultat> {
  const brut = String(formData.get("url") ?? "").trim();
  let url: URL;
  try {
    url = new URL(brut);
  } catch {
    return { error: "URL invalide." };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:")
    return { error: "L'URL doit être en http ou https." };

  let html: string;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_URL),
      redirect: "follow",
    });
    if (!res.ok) return { error: `La page a répondu ${res.status}.` };
    html = await res.text();
  } catch (e) {
    const msg =
      e instanceof Error && e.name === "TimeoutError"
        ? "délai de 15 s dépassé"
        : "impossible à récupérer";
    return { error: `URL : ${msg}.` };
  }
  if (html.length > MAX_HTML) html = html.slice(0, MAX_HTML);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée." };

  const offreId = crypto.randomUUID();
  const chemin = `${offreId}/${Date.now()}-page.html`;
  const up = await supabase.storage
    .from("documents")
    .upload(chemin, Buffer.from(html, "utf8"), {
      contentType: "text/html; charset=utf-8",
      upsert: false,
    });
  if (up.error) return { error: `Stockage échoué : ${up.error.message}` };

  const ins = await supabase.from("offres").insert({
    id: offreId,
    statut: "brouillon",
    source_url: url.toString(),
    source_fichier_url: chemin,
  });
  if (ins.error) {
    await supabase.storage.from("documents").remove([chemin]); // rollback
    return { error: `Création échouée : ${ins.error.message}` };
  }

  revalidatePath("/offres");
  redirect(`/offres/${offreId}`);
}

// ── Suppression d'un brouillon (ligne + fichier source + photos) ───────
export async function supprimerOffre(formData: FormData): Promise<void> {
  const offreId = String(formData.get("offreId") ?? "");
  if (!offreId) throw new Error("Offre introuvable.");

  const supabase = await createClient();
  const { data: offre, error } = await supabase
    .from("offres")
    .select("statut")
    .eq("id", offreId)
    .single();
  if (error || !offre) throw new Error("Offre introuvable.");
  // Garde côté serveur : uniquement les brouillons.
  if (offre.statut !== "brouillon")
    throw new Error("Seuls les brouillons peuvent être supprimés.");

  // Fichiers Storage (documents privé + photos public).
  for (const bucket of ["documents", "photos"] as const) {
    const { data: fichiers } = await supabase.storage.from(bucket).list(offreId);
    if (fichiers && fichiers.length) {
      await supabase.storage
        .from(bucket)
        .remove(fichiers.map((f) => `${offreId}/${f.name}`));
    }
  }

  // La suppression de la ligne offre cascade sur photos.
  const del = await supabase
    .from("offres")
    .delete()
    .eq("id", offreId)
    .eq("statut", "brouillon"); // double garde
  if (del.error) throw new Error(`Suppression échouée : ${del.error.message}`);

  revalidatePath("/offres");
  redirect("/offres");
}

// ── Téléversement de photos (galerie) ──────────────────────────────────
export async function televerserPhotos(formData: FormData): Promise<Resultat> {
  const offreId = String(formData.get("offreId") ?? "");
  if (!offreId) return { error: "Offre introuvable." };

  const fichiers = formData
    .getAll("photos")
    .filter((f): f is File => f instanceof File && f.size > 0);
  if (fichiers.length === 0) return { error: "Aucune photo sélectionnée." };

  const supabase = await createClient();
  const { data: derniere } = await supabase
    .from("photos")
    .select("ordre")
    .eq("offre_id", offreId)
    .order("ordre", { ascending: false })
    .limit(1);
  let ordre = derniere && derniere.length ? (derniere[0].ordre ?? 0) + 1 : 0;

  for (const f of fichiers) {
    if (!TYPES_IMAGE.includes(f.type))
      return { error: `Photo « ${f.name} » : type non accepté (PNG, JPG, WEBP).` };
    if (f.size > MAX_IMAGE)
      return { error: `Photo « ${f.name} » : trop lourde (max 10 Mo).` };

    const chemin = `${offreId}/${Date.now()}-${nomSur(f.name)}`;
    const buf = Buffer.from(await f.arrayBuffer());
    const up = await supabase.storage
      .from("photos")
      .upload(chemin, buf, { contentType: f.type, upsert: false });
    if (up.error)
      return { error: `Téléversement de « ${f.name} » échoué : ${up.error.message}` };

    const ins = await supabase
      .from("photos")
      .insert({ offre_id: offreId, url: chemin, ordre, role: "galerie" });
    if (ins.error) {
      await supabase.storage.from("photos").remove([chemin]); // rollback
      return { error: `Enregistrement échoué : ${ins.error.message}` };
    }
    ordre++;
  }

  revalidatePath(`/offres/${offreId}`);
  return;
}

// ── Désigner une photo comme hero (une seule par offre) ────────────────
export async function definirHero(formData: FormData): Promise<void> {
  const offreId = String(formData.get("offreId") ?? "");
  const photoId = String(formData.get("photoId") ?? "");
  if (!offreId || !photoId) throw new Error("Paramètres manquants.");

  const supabase = await createClient();
  // Démote l'ancien hero AVANT de promouvoir (respecte l'index unique partiel).
  const demote = await supabase
    .from("photos")
    .update({ role: "galerie" })
    .eq("offre_id", offreId)
    .eq("role", "hero");
  if (demote.error) throw new Error(demote.error.message);

  const promote = await supabase
    .from("photos")
    .update({ role: "hero" })
    .eq("id", photoId)
    .eq("offre_id", offreId);
  if (promote.error) throw new Error(promote.error.message);

  revalidatePath(`/offres/${offreId}`);
}

// ── Supprimer une photo ────────────────────────────────────────────────
export async function supprimerPhoto(formData: FormData): Promise<void> {
  const offreId = String(formData.get("offreId") ?? "");
  const photoId = String(formData.get("photoId") ?? "");
  if (!offreId || !photoId) throw new Error("Paramètres manquants.");

  const supabase = await createClient();
  const { data: photo } = await supabase
    .from("photos")
    .select("url")
    .eq("id", photoId)
    .single();
  if (photo?.url) await supabase.storage.from("photos").remove([photo.url]);

  const del = await supabase.from("photos").delete().eq("id", photoId);
  if (del.error) throw new Error(del.error.message);

  revalidatePath(`/offres/${offreId}`);
}
