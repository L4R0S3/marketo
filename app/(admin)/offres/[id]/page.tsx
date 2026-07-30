import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { offreVersFormulaire } from "@/lib/schema/formulaire";
import type { CompositionT } from "@/lib/composition/schema";
import { PhotosSection } from "./PhotosSection";
import { BoutonSupprimer } from "./BoutonSupprimer";
import { FormulaireValidation } from "./FormulaireValidation";

// Écran de validation à deux volets (CLAUDE.md §4, étape 3) : le document source
// à gauche, le formulaire et l'aperçu à droite. Cette étape n'est pas facultative
// — aucune sortie ne se génère depuis un brouillon.

export default async function OffrePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: offre, error } = await supabase
    .from("offres")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !offre) notFound();

  // Aperçu du document source : URL signée 60 min, générée à la volée,
  // jamais stockée (le bucket documents est privé).
  let apercuUrl: string | null = null;
  let apercuType: "image" | "pdf" | "html" | null = null;
  if (offre.source_fichier_url) {
    const { data: signed } = await supabase.storage
      .from("documents")
      .createSignedUrl(offre.source_fichier_url, 3600);
    apercuUrl = signed?.signedUrl ?? null;
    const p = String(offre.source_fichier_url).toLowerCase();
    apercuType = p.endsWith(".pdf") ? "pdf" : p.endsWith(".html") ? "html" : "image";
  }

  const { data: photosBrutes } = await supabase
    .from("photos")
    .select("id, url, ordre, role")
    .eq("offre_id", id)
    .order("ordre");

  const photos = (photosBrutes ?? []).map((p) => ({
    id: p.id as string,
    role: p.role as string,
    publicUrl: supabase.storage.from("photos").getPublicUrl(p.url as string).data
      .publicUrl,
  }));
  const heroUrl = photos.find((p) => p.role === "hero")?.publicUrl ?? null;

  // Valeurs du formulaire : les colonnes (faits corrigés), la sortie de l'Appel 2
  // et, si l'opérateur a déjà enregistré, ce qu'il a écrit — contenus.fr prime.
  const brute = (offre.extraction_brute as Record<string, unknown> | null) ?? {};
  const extraction = (brute.extraction as Record<string, unknown> | null) ?? {};
  const compositionBrute = brute.composition as Record<string, unknown> | null;
  const composition =
    compositionBrute && !compositionBrute.erreur
      ? (compositionBrute as unknown as CompositionT)
      : null;
  const contenus = (offre.contenus as Record<string, unknown> | null) ?? {};
  const contenusFr = (contenus.fr as Record<string, unknown> | null) ?? null;
  const aDejaEteEdite = contenusFr != null && Object.keys(contenusFr).length > 0;

  const defauts = offreVersFormulaire(
    offre as Record<string, unknown>,
    extraction,
    aDejaEteEdite ? (contenusFr?.visuel ? visuelVersComposition(contenusFr) : composition) : composition,
    contenusFr,
  );

  const estBrouillon = offre.statut === "brouillon";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">
            {(contenusFr?.titre as string) ||
              offre.destination_pays ||
              "Offre sans destination"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {offre.slug} ·{" "}
            <span className="rounded bg-muted px-1.5 py-0.5">{offre.statut}</span>
          </p>
        </div>
        <Link href="/offres" className="text-sm text-muted-foreground underline">
          Retour à la liste
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        {/* Volet gauche : la source, collante pour rester visible pendant la saisie */}
        <div className="flex flex-col gap-4 lg:sticky lg:top-4 lg:self-start">
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold">Document source</h2>
            {offre.source_url && (
              <p className="text-sm break-all">
                URL :{" "}
                <a
                  href={offre.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  {offre.source_url}
                </a>
              </p>
            )}
            {apercuUrl ? (
              apercuType === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={apercuUrl}
                  alt="Document source"
                  className="max-h-[80vh] w-auto rounded-md border"
                />
              ) : (
                <iframe
                  src={apercuUrl}
                  className="h-[80vh] w-full rounded-md border"
                  title="Document source"
                />
              )
            ) : (
              <p className="text-sm text-muted-foreground">Aucun document source.</p>
            )}
          </section>

          <PhotosSection offreId={id} photos={photos} />

          {estBrouillon && (
            <section className="flex flex-col gap-2 border-t pt-4">
              <h2 className="text-sm font-semibold">Zone dangereuse</h2>
              <p className="text-sm text-muted-foreground">
                Supprime le brouillon, son document source et ses photos.
              </p>
              <div>
                <BoutonSupprimer offreId={id} />
              </div>
            </section>
          )}
        </div>

        {/* Volet droit : aperçu + formulaire */}
        <FormulaireValidation
          offreId={id}
          statut={offre.statut as string}
          defauts={defauts}
          heroUrl={heroUrl}
          aDesFaits={offre.prix_par_personne != null}
          aDuTexte={composition != null || aDejaEteEdite}
        />
      </div>
    </div>
  );
}

// contenus.fr (version éditée par l'humain) relu comme une composition, pour que
// le formulaire reparte de ce que l'opérateur a écrit et non de la sortie de l'IA.
function visuelVersComposition(contenusFr: Record<string, unknown>): CompositionT {
  const v = contenusFr.visuel as Record<string, unknown>;
  const colonnes = (v.colonnes as Array<Record<string, unknown>>) ?? [];
  return {
    titre: (v.titre as string) ?? "",
    bandeau: (v.bandeau as string) ?? "",
    colonnes: colonnes.map((c) => ({
      entete: (c.entete as string | null) ?? "",
      blocs: ((c.blocs as Array<{ lignes: string[] }>) ?? []).map((b) => ({
        lignes: b.lignes ?? [],
      })),
      prix: c.prix as { surtitre: string; montant: number; mentions: string[] },
    })),
    prix_secondaire:
      (v.prix_secondaire as { surtitre: string; montant: number; mentions: string[] } | null) ??
      undefined,
    badge: (v.badge as { texte: string; icone: string } | null) ?? undefined,
    accroche: (contenusFr.accroche as string) ?? "",
    faq: ((contenusFr.faq as Array<{ q: string; r: string }>) ?? []),
  };
}
