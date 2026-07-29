"use client";

import { useActionState } from "react";
import {
  televerserPhotos,
  definirHero,
  supprimerPhoto,
} from "@/app/(admin)/offres/actions";
import { Button } from "@/components/ui/button";

type Photo = { id: string; role: string; publicUrl: string };

export function PhotosSection({
  offreId,
  photos,
}: {
  offreId: string;
  photos: Photo[];
}) {
  const [etat, action, enCours] = useActionState(
    async (_prev: { error: string } | undefined, formData: FormData) =>
      await televerserPhotos(formData),
    undefined,
  );

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold">Photos</h2>

      <form action={action} className="flex flex-col gap-2">
        <input type="hidden" name="offreId" value={offreId} />
        <input
          type="file"
          name="photos"
          multiple
          accept="image/png,image/jpeg,image/webp"
          className="text-sm"
        />
        <div>
          <Button type="submit" size="sm" disabled={enCours}>
            {enCours ? "Téléversement…" : "Ajouter les photos"}
          </Button>
        </div>
        {etat?.error && <p className="text-sm text-red-600">{etat.error}</p>}
      </form>

      {photos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune photo.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {photos.map((photo) => (
            <li key={photo.id} className="flex flex-col gap-1">
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.publicUrl}
                  alt=""
                  className={`aspect-video w-full rounded-md border object-cover ${
                    photo.role === "hero" ? "ring-2 ring-primary" : ""
                  }`}
                />
                {photo.role === "hero" && (
                  <span className="absolute left-1 top-1 rounded bg-primary px-1.5 py-0.5 text-xs text-primary-foreground">
                    ★ hero
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {photo.role !== "hero" && (
                  <form action={definirHero}>
                    <input type="hidden" name="offreId" value={offreId} />
                    <input type="hidden" name="photoId" value={photo.id} />
                    <Button type="submit" size="sm" variant="outline">
                      Hero
                    </Button>
                  </form>
                )}
                <form action={supprimerPhoto}>
                  <input type="hidden" name="offreId" value={offreId} />
                  <input type="hidden" name="photoId" value={photo.id} />
                  <Button type="submit" size="sm" variant="ghost">
                    Supprimer
                  </Button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
