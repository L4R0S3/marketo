"use client";

import { supprimerOffre } from "@/app/(admin)/offres/actions";
import { Button } from "@/components/ui/button";

export function BoutonSupprimer({ offreId }: { offreId: string }) {
  return (
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
      <Button type="submit" variant="destructive" size="sm">
        Supprimer le brouillon
      </Button>
    </form>
  );
}
