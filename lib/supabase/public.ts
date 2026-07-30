import { createClient as creerClient } from "@supabase/supabase-js";

// Client Supabase ANONYME, sans cookies. Les landing pages sont générées
// statiquement : lire les cookies les rendrait dynamiques et supprimerait tout
// l'intérêt du rendu à la génération. Ce client ne voit donc que ce que le rôle
// anon a le droit de voir — c'est-à-dire la vue offres_publiques.

export function creerClientPublic() {
  return creerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

// URL publique d'un objet du bucket photos, construite sans appel réseau.
export function urlPhoto(chemin: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/photos/${chemin}`;
}
