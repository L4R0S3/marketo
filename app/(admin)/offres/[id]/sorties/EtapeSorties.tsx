"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  Globe,
  Mail,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ApercuCourriel } from "@/components/ApercuCourriel";
import { CopierHtml } from "@/components/CopierHtml";
import { archiverOffre, publierOffre } from "../actions";
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
  courrielHtml,
  statut,
  urlPublique,
}: {
  offreId: string;
  slug: string;
  titre: string;
  accroche: string;
  courrielHtml: string | null;
  statut: string;
  urlPublique: string;
}) {
  const router = useRouter();
  const [copie, setCopie] = useState(false);
  const [version, setVersion] = useState(0); // force le rechargement de l'image
  const [enCours, demarrer] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const url = `/api/og/${offreId}?v=${version}`;

  const publiee = statut === "publiee";
  const validee = statut === "validee";
  const archivee = statut === "archivee";

  const agir = (action: () => Promise<{ error: string } | { ok: true; message: string }>) =>
    demarrer(async () => {
      const r = await action();
      setMessage("error" in r ? r.error : r.message);
      router.refresh();
    });

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

        {/* Bloc courriel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Mail className="size-4" />
              Bloc courriel
            </CardTitle>
            <CardDescription>
              Variante vedette, prête à coller dans Mailchimp. Pour un envoi qui regroupe
              plusieurs offres, passe par une campagne.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {courrielHtml ? (
              <>
                <ApercuCourriel html={courrielHtml} hauteur={520} />
                <div className="flex flex-wrap gap-2">
                  <CopierHtml html={courrielHtml} />
                  <Button asChild variant="outline">
                    <Link href="/campagnes">Composer une campagne</Link>
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Le bloc courriel n&apos;a pas pu être généré pour cette offre.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Landing page et publication */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ExternalLink className="size-4" />
              Page de destination
            </CardTitle>
            <CardDescription>
              {publiee
                ? "En ligne : c'est la page vers laquelle pointent le post et le courriel."
                : archivee
                  ? "Archivée : la page ne répond plus. Le lien reste réservé à cette offre."
                  : "L'offre doit être publiée pour que cette page réponde."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <code className="rounded-md bg-muted/50 p-3 text-xs break-all">{urlPublique}</code>

            {validee && (
              <>
                <Button type="button" disabled={enCours} onClick={() => agir(() => publierOffre(offreId))}>
                  <Globe className="size-4" />
                  {enCours ? "Publication…" : "Publier l'offre"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  La publication met la page en ligne et <strong>fige l&apos;adresse</strong> :
                  elle ne pourra plus changer, même après archivage.
                </p>
              </>
            )}

            {publiee && (
              <div className="flex flex-wrap gap-2">
                <Button asChild>
                  <a href={`/voyage/${slug}`} target="_blank" rel="noreferrer">
                    <ExternalLink className="size-4" />
                    Ouvrir la page
                  </a>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigator.clipboard.writeText(urlPublique)}
                >
                  Copier le lien
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button type="button" variant="ghost" disabled={enCours}>
                      Dépublier
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Dépublier cette offre ?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Elle passe au statut archivé et disparaît immédiatement de la page
                        publique : le lien qui circule dans les posts et les courriels ne
                        répondra plus. L&apos;offre et son contenu sont conservés.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction onClick={() => agir(() => archiverOffre(offreId))}>
                        Dépublier et archiver
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}

            {message && <p className="text-sm">{message}</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
