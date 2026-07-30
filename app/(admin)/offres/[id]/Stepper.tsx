"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Indicateur de progression du flux. L'opérateur ne voit qu'une étape à la fois ;
// le stepper lui dit où il en est et ce qui reste. Une étape non atteignable
// (pas de faits, pas de validation) n'est pas cliquable.

const ETAPES = [
  { cle: "depot", nom: "Dépôt", sous: null },
  { cle: "faits", nom: "Faits", sous: "faits" },
  { cle: "visuel", nom: "Visuel", sous: "visuel" },
  { cle: "sorties", nom: "Sorties", sous: "sorties" },
] as const;

export function Stepper({
  offreId,
  aDesFaits,
  estValidee,
}: {
  offreId: string;
  aDesFaits: boolean;
  estValidee: boolean;
}) {
  const chemin = usePathname();
  const courante = ETAPES.findIndex((e) => e.sous && chemin.endsWith(`/${e.sous}`));
  const indexCourant = courante === -1 ? 1 : courante;

  const accessible = (i: number) => {
    if (i === 0) return false; // le dépôt est passé, on n'y revient pas
    if (i === 1) return true;
    if (i === 2) return aDesFaits;
    return estValidee;
  };

  return (
    <ol className="flex flex-wrap items-center gap-2 text-sm">
      {ETAPES.map((e, i) => {
        const etat =
          i < indexCourant || (i === 0)
            ? "faite"
            : i === indexCourant
              ? "courante"
              : "a-venir";
        const contenu = (
          <span
            className={
              "flex items-center gap-2 rounded-full border px-3 py-1 " +
              (etat === "courante"
                ? "border-foreground bg-foreground text-background"
                : etat === "faite"
                  ? "border-muted-foreground/40 text-muted-foreground"
                  : "border-dashed border-muted-foreground/30 text-muted-foreground/60")
            }
          >
            <span className="text-xs">{etat === "faite" ? "✓" : i + 1}</span>
            {e.nom}
          </span>
        );
        return (
          <li key={e.cle} className="flex items-center gap-2">
            {accessible(i) && i !== indexCourant ? (
              <Link href={`/offres/${offreId}/${e.sous}`}>{contenu}</Link>
            ) : (
              contenu
            )}
            {i < ETAPES.length - 1 && (
              <span className="text-muted-foreground/40">—</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
