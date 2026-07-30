"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Plus, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { StatutBadge } from "@/components/StatutBadge";
import { ApercuCourriel } from "@/components/ApercuCourriel";
import { CopierHtml } from "@/components/CopierHtml";
import {
  ajouterOffre,
  definirVedette,
  reordonner,
  retirerOffre,
} from "../actions";
import type { OffreEligible } from "./page";

// Composition à deux volets : les choix à gauche, le courriel assemblé à droite.
// Chaque geste enregistre puis rafraîchit — l'aperçu est toujours celui du HTML
// réellement compilé côté serveur, jamais une approximation.

function Ligne({ offre, actions }: { offre: OffreEligible; actions?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border p-3">
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium">{offre.titre}</span>
        <span className="text-xs text-muted-foreground">
          {[offre.destination, offre.prix ? `${offre.prix} $` : null].filter(Boolean).join(" · ")}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <StatutBadge statut={offre.statut} />
        {actions}
      </div>
    </div>
  );
}

export function CompositionCampagne({
  campagneId,
  nom,
  vedette,
  secondaires,
  eligibles,
  courrielHtml,
}: {
  campagneId: string;
  nom: string;
  vedette: OffreEligible | null;
  secondaires: OffreEligible[];
  eligibles: OffreEligible[];
  courrielHtml: string;
}) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const agir = (action: () => Promise<{ error: string } | { ok: true }>) =>
    demarrer(async () => {
      const r = await action();
      setMessage("error" in r ? r.error : null);
      router.refresh();
    });

  const dejaUtilisees = new Set([vedette?.id, ...secondaires.map((o) => o.id)].filter(Boolean));
  const disponibles = eligibles.filter((o) => !dejaUtilisees.has(o.id));

  const deplacer = (index: number, delta: number) => {
    const ordre = secondaires.map((o) => o.id);
    const cible = index + delta;
    if (cible < 0 || cible >= ordre.length) return;
    [ordre[index], ordre[cible]] = [ordre[cible], ordre[index]];
    agir(() => reordonner(campagneId, ordre));
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,620px)]">
      {/* Volet gauche : la composition */}
      <div className="flex flex-col gap-5">
        {message && <p className="text-sm text-destructive">{message}</p>}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Star className="size-4" />
              Offre vedette
            </CardTitle>
            <CardDescription>
              Elle ouvre le courriel, en grand format. C&apos;est aussi elle qui devient le post
              social de la semaine.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {vedette ? (
              <Ligne
                offre={vedette}
                actions={
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={enCours}
                    onClick={() => agir(() => definirVedette(campagneId, null))}
                  >
                    Retirer
                  </Button>
                }
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Aucune offre vedette. Choisis-en une dans la liste ci-dessous.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Offres secondaires</CardTitle>
            <CardDescription>
              Format condensé, dans l&apos;ordre d&apos;apparition du courriel.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {secondaires.length === 0 && (
              <p className="text-sm text-muted-foreground">Aucune offre secondaire.</p>
            )}
            {secondaires.map((o, i) => (
              <Ligne
                key={o.id}
                offre={o}
                actions={
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Monter"
                      disabled={enCours || i === 0}
                      onClick={() => deplacer(i, -1)}
                    >
                      <ArrowUp className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Descendre"
                      disabled={enCours || i === secondaires.length - 1}
                      onClick={() => deplacer(i, 1)}
                    >
                      <ArrowDown className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Retirer"
                      disabled={enCours}
                      onClick={() => agir(() => retirerOffre(campagneId, o.id))}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </>
                }
              />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Offres disponibles</CardTitle>
            <CardDescription>
              Seules les offres validées ou publiées peuvent partir en courriel.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {disponibles.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Aucune autre offre disponible. Valide une offre pour la rendre éligible.
              </p>
            )}
            {disponibles.map((o) => (
              <Ligne
                key={o.id}
                offre={o}
                actions={
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={enCours}
                      onClick={() => agir(() => definirVedette(campagneId, o.id))}
                    >
                      <Star className="size-4" />
                      Vedette
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={enCours}
                      onClick={() => agir(() => ajouterOffre(campagneId, o.id))}
                    >
                      <Plus className="size-4" />
                      Ajouter
                    </Button>
                  </>
                }
              />
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Volet droit : le courriel assemblé */}
      <Card className="lg:sticky lg:top-20 lg:self-start">
        <CardHeader>
          <CardTitle className="text-base">Courriel assemblé</CardTitle>
          <CardDescription>
            {`« ${nom} » — en-tête, blocs, pied de page. C'est exactement ce que copie le bouton.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <ApercuCourriel html={courrielHtml} hauteur={760} />
          <Separator />
          <div className="flex flex-wrap items-center gap-2">
            <CopierHtml html={courrielHtml} libelle="Copier le HTML" />
            <span className="text-xs text-muted-foreground">
              Dans Mailchimp : bloc « Code », puis coller.
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
