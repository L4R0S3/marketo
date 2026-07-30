"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supprimerOffre } from "@/app/(admin)/offres/actions";
import { repasserEnBrouillon } from "./actions";
import { Button } from "@/components/ui/button";

// Menu discret de l'offre : les actions rares et dangereuses ne prennent pas de
// place en pleine page. Un simple bouton « … » qui déplie une liste.

export function MenuOffre({
  offreId,
  statut,
}: {
  offreId: string;
  statut: string;
}) {
  const [ouvert, setOuvert] = useState(false);
  const router = useRouter();

  return (
    <div className="relative">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label="Actions de l'offre"
        onClick={() => setOuvert((o) => !o)}
      >
        …
      </Button>

      {ouvert && (
        <div
          className="absolute right-0 z-20 mt-1 flex w-64 flex-col gap-1 rounded-md border bg-background p-1 shadow-md"
          onMouseLeave={() => setOuvert(false)}
        >
          {statut === "validee" && (
            <button
              type="button"
              className="rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
              onClick={async () => {
                setOuvert(false);
                await repasserEnBrouillon(offreId);
                router.refresh();
              }}
            >
              Repasser en brouillon
            </button>
          )}

          {statut === "brouillon" ? (
            <form
              action={supprimerOffre}
              onSubmit={(e) => {
                if (
                  !confirm(
                    "Supprimer définitivement ce brouillon, son document source et ses photos ?",
                  )
                )
                  e.preventDefault();
              }}
            >
              <input type="hidden" name="offreId" value={offreId} />
              <button
                type="submit"
                className="w-full rounded px-2 py-1.5 text-left text-sm text-destructive hover:bg-muted"
              >
                Supprimer le brouillon
              </button>
            </form>
          ) : (
            <span className="px-2 py-1.5 text-xs text-muted-foreground">
              Seul un brouillon peut être supprimé.
            </span>
          )}
        </div>
      )}
    </div>
  );
}
