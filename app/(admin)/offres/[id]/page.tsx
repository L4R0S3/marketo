import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PhotosSection } from "./PhotosSection";
import { BoutonSupprimer } from "./BoutonSupprimer";

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

  const estBrouillon = offre.statut === "brouillon";

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">
            {offre.destination_pays ?? "Offre sans destination"}
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

      {/* Document source */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Document source</h2>
        {offre.source_url && (
          <p className="text-sm">
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
              className="max-h-[70vh] w-auto rounded-md border"
            />
          ) : (
            <iframe
              src={apercuUrl}
              className="h-[70vh] w-full rounded-md border"
              title="Document source"
            />
          )
        ) : (
          <p className="text-sm text-muted-foreground">Aucun document source.</p>
        )}
      </section>

      {/* Photos */}
      <PhotosSection offreId={id} photos={photos} />

      {/* Suppression — brouillon uniquement */}
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
  );
}
