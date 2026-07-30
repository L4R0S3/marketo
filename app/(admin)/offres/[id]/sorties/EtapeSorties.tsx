"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

// Étape 4. Le PNG 1080 × 1350 est rendu par /api/og/[id] ; le navigateur l'affiche
// et le télécharge. Le texte de publication se copie en un clic.

export function EtapeSorties({
  offreId,
  slug,
  titre,
  accroche,
}: {
  offreId: string;
  slug: string;
  titre: string;
  accroche: string;
}) {
  const [copie, setCopie] = useState(false);
  const [version, setVersion] = useState(0); // force le rechargement de l'image
  const url = `/api/og/${offreId}?v=${version}`;

  async function copier() {
    await navigator.clipboard.writeText(accroche);
    setCopie(true);
    setTimeout(() => setCopie(false), 2000);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,540px)_minmax(0,1fr)]">
      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Post social — 1080 × 1350</h2>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={`Post social — ${titre}`}
          className="w-full rounded-md border"
          width={1080}
          height={1350}
        />
        <div className="flex flex-wrap gap-2">
          <a href={url} download={`${slug}.png`}>
            <Button type="button">Télécharger le PNG</Button>
          </a>
          <Button type="button" variant="outline" onClick={() => setVersion((v) => v + 1)}>
            Regénérer l&apos;image
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Format 4:5, accepté tel quel par Facebook et Instagram — aucun recadrage.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Texte de publication</h2>
            <Button type="button" size="sm" variant="outline" onClick={copier}>
              {copie ? "Copié ✓" : "Copier le texte"}
            </Button>
          </div>
          <p className="whitespace-pre-wrap rounded-md border p-3 text-sm">
            {accroche || "Aucune accroche : reviens à l'étape du visuel."}
          </p>
        </section>

        <section className="flex flex-col gap-2 rounded-md border border-dashed p-3">
          <h2 className="text-sm font-semibold text-muted-foreground">À venir</h2>
          <p className="text-sm text-muted-foreground">
            Le bloc HTML pour Mailchimp et la landing page publique arrivent aux phases
            suivantes. Cette étape ne produit pour l&apos;instant que le post Facebook et
            Instagram.
          </p>
        </section>
      </div>
    </div>
  );
}
