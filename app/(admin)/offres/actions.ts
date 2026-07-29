"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { detecterType } from "@/lib/fichiers/validerType";

// undefined = succès (l'action redirige ou revalide) ; { error } = échec affiché.
type Resultat = { error: string } | undefined;

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

  // Taille : file.size = octets réellement reçus (fiable, non déclaratif).
  if (file.size > MAX_PDF) return { error: "Fichier trop lourd (max 20 Mo)." };

  // Type : détecté par signature binaire, PAS par le MIME déclaré (spoofable).
  const buf = Buffer.from(await file.arrayBuffer());
  const detecte = detecterType(buf);
  if (!detecte) return { error: "Type non reconnu (PNG, JPG, WEBP ou PDF)." };
  if (detecte.estImage && file.size > MAX_IMAGE)
    return { error: "Image trop lourde (max 10 Mo)." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée." };

  const offreId = crypto.randomUUID();
  const chemin = `${offreId}/${Date.now()}-${nomSur(file.name)}`;

  // INSERT d'abord : un échec laisse au pire une ligne visible et supprimable
  // (via le bouton existant), jamais un fichier orphelin introuvable.
  const ins = await supabase
    .from("offres")
    .insert({ id: offreId, statut: "brouillon", source_fichier_url: chemin });
  if (ins.error) return { error: `Création échouée : ${ins.error.message}` };

  // UPLOAD ensuite ; sur erreur retournée OU exception levée, on nettoie la ligne.
  try {
    const up = await supabase.storage
      .from("documents")
      .upload(chemin, buf, { contentType: detecte.mime, upsert: false });
    if (up.error) throw new Error(up.error.message);
  } catch (e) {
    await supabase.from("offres").delete().eq("id", offreId);
    await supabase.storage.from("documents").remove([chemin]); // au cas où l'objet a été créé
    return {
      error: `Téléversement échoué : ${e instanceof Error ? e.message : "erreur inconnue"}`,
    };
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

  // INSERT d'abord (même logique anti-orphelin que le dépôt de fichier).
  const ins = await supabase.from("offres").insert({
    id: offreId,
    statut: "brouillon",
    source_url: url.toString(),
    source_fichier_url: chemin,
  });
  if (ins.error) return { error: `Création échouée : ${ins.error.message}` };

  try {
    const up = await supabase.storage
      .from("documents")
      .upload(chemin, Buffer.from(html, "utf8"), {
        contentType: "text/html; charset=utf-8",
        upsert: false,
      });
    if (up.error) throw new Error(up.error.message);
  } catch (e) {
    await supabase.from("offres").delete().eq("id", offreId);
    await supabase.storage.from("documents").remove([chemin]);
    return {
      error: `Stockage échoué : ${e instanceof Error ? e.message : "erreur inconnue"}`,
    };
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
    if (f.size > MAX_IMAGE)
      return { error: `Photo « ${f.name} » : trop lourde (max 10 Mo).` };

    // Type par signature binaire ; images uniquement pour ce bucket.
    const buf = Buffer.from(await f.arrayBuffer());
    const detecte = detecterType(buf);
    if (!detecte || !detecte.estImage)
      return { error: `Photo « ${f.name} » : type non accepté (PNG, JPG, WEBP).` };

    const chemin = `${offreId}/${Date.now()}-${nomSur(f.name)}`;

    // INSERT d'abord, UPLOAD ensuite : pas de fichier orphelin dans le bucket
    // public si l'enregistrement échoue.
    const ins = await supabase
      .from("photos")
      .insert({ offre_id: offreId, url: chemin, ordre, role: "galerie" })
      .select("id")
      .single();
    if (ins.error || !ins.data)
      return {
        error: `Enregistrement de « ${f.name} » échoué : ${ins.error?.message ?? "inconnu"}`,
      };

    try {
      const up = await supabase.storage
        .from("photos")
        .upload(chemin, buf, { contentType: detecte.mime, upsert: false });
      if (up.error) throw new Error(up.error.message);
    } catch (e) {
      await supabase.from("photos").delete().eq("id", ins.data.id);
      await supabase.storage.from("photos").remove([chemin]);
      return {
        error: `Téléversement de « ${f.name} » échoué : ${e instanceof Error ? e.message : "inconnu"}`,
      };
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
