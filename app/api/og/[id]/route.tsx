import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";
import { Gabarit, LARGEUR, HAUTEUR } from "@/lib/templates/social/Gabarit";
import { chargerPolices } from "@/lib/templates/social/polices";
import { PostVisuel } from "@/lib/templates/social/schema";

export const runtime = "nodejs"; // lecture des polices sur le disque

// GET /api/og/[id] → le post social en PNG 1080 × 1350.
// Le visuel rendu est celui de contenus.fr.visuel : la version VALIDÉE par
// l'humain, jamais la sortie brute de l'IA.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Non authentifié.", { status: 401 });

  const { data: offre } = await supabase
    .from("offres")
    .select("statut, contenus")
    .eq("id", id)
    .single();
  if (!offre) return new Response("Offre introuvable.", { status: 404 });

  // Garde serveur, pas seulement d'interface : aucune sortie depuis un brouillon.
  if (offre.statut === "brouillon")
    return new Response(
      "Offre au statut brouillon : passe par l'écran de validation avant de générer une sortie.",
      { status: 409 },
    );

  const contenus = offre.contenus as Record<string, unknown> | null;
  const fr = (contenus?.fr ?? null) as Record<string, unknown> | null;
  const lu = PostVisuel.safeParse(fr?.visuel);
  if (!lu.success)
    return new Response("Aucun visuel validé pour cette offre.", { status: 409 });

  return new ImageResponse(<Gabarit visuel={lu.data} />, {
    width: LARGEUR,
    height: HAUTEUR,
    fonts: chargerPolices(),
  });
}
