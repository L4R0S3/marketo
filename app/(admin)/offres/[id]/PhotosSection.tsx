"use client";

import { useActionState, useState } from "react";
import {
  televerserPhotos,
  definirHero,
  supprimerPhoto,
} from "@/app/(admin)/offres/actions";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

type Photo = { id: string; role: string; publicUrl: string };

export function PhotosSection({
  offreId,
  photos,
}: {
  offreId: string;
  photos: Photo[];
}) {
  // Note : useActionState n'offre l'amélioration progressive qu'avec un
  // `permalink`. Ce formulaire ne fonctionne donc qu'une fois la page hydratée —
  // acceptable ici (tout l'écran dépend déjà de JavaScript), mais c'est ce qui l'a
  // rendu totalement inerte tant qu'un <form> imbriqué cassait l'hydratation.
  const [etat, action, enCours] = useActionState(
    async (_prev: { error: string } | undefined, formData: FormData) =>
      await televerserPhotos(formData),
    undefined,
  );

  // Le bouton restait actif sans fichier choisi : le clic partait, l'action
  // répondait « Aucune photo sélectionnée » en petit rouge, et l'impression
  // donnée était que le bouton ne faisait rien. On désactive plutôt, et on
  // annonce ce qui est sélectionné.
  const [choisis, setChoisis] = useState<string[]>([]);

  return (
    // Pas de titre ici : la carte qui accueille cette section en porte un.
    <section className="flex flex-col gap-3">
      <form action={action} className="flex flex-col gap-2" onSubmit={() => setChoisis([])}>
        <input type="hidden" name="offreId" value={offreId} />
        <input
          type="file"
          name="photos"
          multiple
          accept="image/png,image/jpeg,image/webp"
          className="text-sm"
          onChange={(e) => setChoisis(Array.from(e.target.files ?? []).map((f) => f.name))}
        />
        <div className="flex items-center gap-3">
          <Button type="submit" size="sm" disabled={enCours || choisis.length === 0}>
            {enCours ? "Téléversement…" : "Ajouter les photos"}
          </Button>
          <span className="text-xs text-muted-foreground">
            {choisis.length === 0
              ? "Choisis un fichier pour activer le bouton."
              : choisis.join(", ")}
          </span>
        </div>
        {etat?.error && (
          <Alert variant="destructive">
            <AlertDescription>{etat.error}</AlertDescription>
          </Alert>
        )}
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
