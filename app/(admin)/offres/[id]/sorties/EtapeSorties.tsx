"use client";

import { useState } from "react";
import { Check, Copy, Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Étape 4. Le PNG est rendu par /api/og/[id] ; le navigateur l'affiche et le
// télécharge. Le texte de publication se copie en un clic.

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
    setTimeout(() => setCopie(false), 2500);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,520px)_minmax(0,1fr)]">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Post social</CardTitle>
          <CardDescription>
            1080 × 1350, format 4:5 — accepté tel quel par Facebook et Instagram, sans
            recadrage.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={`Post social — ${titre}`}
            className="w-full rounded-lg border shadow-lg"
            width={1080}
            height={1350}
          />
        </CardContent>
        <CardFooter className="flex-col items-stretch gap-2">
          <div className="flex gap-2">
            <Button asChild className="flex-1">
              <a href={url} download={`${slug}.png`}>
                <Download className="size-4" />
                Télécharger le PNG
              </a>
            </Button>
            <Button variant="outline" className="flex-1" onClick={copier}>
              {copie ? <Check className="size-4" /> : <Copy className="size-4" />}
              Copier le texte
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => setVersion((v) => v + 1)}
          >
            <RefreshCw className="size-3.5" />
            Regénérer l&apos;image
          </Button>
        </CardFooter>
      </Card>

      <div className="flex flex-col gap-4">
        {copie && (
          <Alert>
            <Check />
            <AlertDescription>
              Texte copié — colle-le dans la publication Facebook ou Instagram.
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Texte de publication</CardTitle>
            <CardDescription>L&apos;accroche validée à l&apos;étape précédente.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="rounded-md bg-muted/50 p-4 text-sm leading-relaxed whitespace-pre-wrap">
              {accroche || "Aucune accroche : reviens à l'étape du visuel."}
            </p>
          </CardContent>
        </Card>

        <Card className="border-dashed bg-transparent shadow-none">
          <CardHeader>
            <CardTitle className="text-base font-medium text-muted-foreground">
              À venir
            </CardTitle>
            <CardDescription>
              Le bloc HTML pour Mailchimp et la landing page publique arrivent aux phases
              suivantes. Cette étape ne produit pour l&apos;instant que le post Facebook et
              Instagram.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
