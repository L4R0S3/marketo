"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check } from "lucide-react";

// Indicateur de progression. L'opérateur ne voit qu'une étape à la fois ; le
// stepper lui dit où il en est. Une étape non atteignable n'est pas cliquable.

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
  const trouvee = ETAPES.findIndex((e) => e.sous && chemin.endsWith(`/${e.sous}`));
  const courante = trouvee === -1 ? 1 : trouvee;

  const accessible = (i: number) => {
    if (i === 0) return false; // le dépôt est passé, on n'y revient pas
    if (i === 1) return true;
    if (i === 2) return aDesFaits;
    return estValidee;
  };

  return (
    <ol className="flex flex-wrap items-center gap-1">
      {ETAPES.map((e, i) => {
        const faite = i < courante;
        const active = i === courante;
        const contenu = (
          <span
            className={
              "flex items-center gap-2 rounded-full py-1.5 pr-4 pl-1.5 text-sm font-medium transition-colors " +
              (active
                ? "bg-primary text-primary-foreground"
                : faite
                  ? "text-foreground hover:bg-muted"
                  : "text-muted-foreground/60")
            }
          >
            <span
              className={
                "flex size-6 items-center justify-center rounded-full text-xs " +
                (active
                  ? "bg-primary-foreground/20"
                  : faite
                    ? "bg-primary/10 text-primary"
                    : "border border-dashed")
              }
            >
              {faite ? <Check className="size-3.5" /> : i + 1}
            </span>
            {e.nom}
          </span>
        );
        return (
          <li key={e.cle} className="flex items-center">
            {accessible(i) && !active ? (
              <Link href={`/offres/${offreId}/${e.sous}`}>{contenu}</Link>
            ) : (
              contenu
            )}
            {i < ETAPES.length - 1 && (
              <span
                aria-hidden
                className={"mx-1 h-px w-6 " + (faite ? "bg-primary/30" : "bg-border")}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
