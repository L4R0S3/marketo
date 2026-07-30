import { Badge } from "@/components/ui/badge";

// Un statut, une couleur, partout pareil : gris brouillon, bleu validée,
// vert publiée, orange atténué archivée. Simple composition du Badge shadcn.

const STYLES: Record<string, { libelle: string; classe: string }> = {
  brouillon: {
    libelle: "Brouillon",
    classe: "bg-muted text-muted-foreground border-transparent",
  },
  validee: {
    libelle: "Validée",
    classe: "bg-blue-100 text-blue-800 border-transparent dark:bg-blue-950 dark:text-blue-300",
  },
  publiee: {
    libelle: "Publiée",
    classe:
      "bg-emerald-100 text-emerald-800 border-transparent dark:bg-emerald-950 dark:text-emerald-300",
  },
  archivee: {
    libelle: "Archivée",
    classe:
      "bg-orange-100/70 text-orange-800/80 border-transparent dark:bg-orange-950/60 dark:text-orange-300/80",
  },
};

export function StatutBadge({ statut }: { statut: string }) {
  const s = STYLES[statut] ?? { libelle: statut, classe: "" };
  return (
    <Badge variant="outline" className={s.classe}>
      {s.libelle}
    </Badge>
  );
}
