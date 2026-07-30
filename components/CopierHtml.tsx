"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

// Copie du HTML courriel dans le presse-papiers. Le bouton dit ce qui s'est
// passé : sans retour visible, on ne sait pas si le clic a pris.

export function CopierHtml({
  html,
  libelle = "Copier le HTML",
  taille = "default",
}: {
  html: string;
  libelle?: string;
  taille?: "default" | "sm" | "lg";
}) {
  const [copie, setCopie] = useState(false);

  return (
    <Button
      type="button"
      size={taille}
      onClick={async () => {
        await navigator.clipboard.writeText(html);
        setCopie(true);
        setTimeout(() => setCopie(false), 2500);
      }}
    >
      {copie ? <Check className="size-4" /> : <Copy className="size-4" />}
      {copie ? "HTML copié" : libelle}
    </Button>
  );
}
