"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileCheck2, Link2, UploadCloud } from "lucide-react";
import {
  creerOffreDepuisFichier,
  creerOffreDepuisUrl,
} from "@/app/(admin)/offres/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const TYPES_IMAGE = ["image/png", "image/jpeg", "image/webp"];
const MAX_IMAGE = 10 * 1024 * 1024;
const MAX_PDF = 20 * 1024 * 1024;

function validerFichier(f: File): string | null {
  const estImage = TYPES_IMAGE.includes(f.type);
  const estPdf = f.type === "application/pdf";
  if (!estImage && !estPdf) return "Type non accepté (PNG, JPG, WEBP ou PDF).";
  if (estImage && f.size > MAX_IMAGE) return "Image trop lourde (max 10 Mo).";
  if (estPdf && f.size > MAX_PDF) return "PDF trop lourd (max 20 Mo).";
  return null;
}

export default function NouvelleOffrePage() {
  const [fichier, setFichier] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [survol, setSurvol] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function choisir(f: File | undefined) {
    if (!f) return;
    const err = validerFichier(f);
    if (err) {
      setErreur(err);
      setFichier(null);
      return;
    }
    setErreur(null);
    setFichier(f);
  }

  async function deposerFichier() {
    if (!fichier) return;
    setErreur(null);
    setEnCours(true);
    const fd = new FormData();
    fd.set("fichier", fichier);
    const r = await creerOffreDepuisFichier(fd);
    // Succès = redirection gérée par l'action ; on n'arrive ici qu'en cas d'erreur.
    if (r?.error) {
      setErreur(r.error);
      setEnCours(false);
    }
  }

  async function deposerUrl() {
    if (!url.trim()) return;
    setErreur(null);
    setEnCours(true);
    const fd = new FormData();
    fd.set("url", url.trim());
    const r = await creerOffreDepuisUrl(fd);
    if (r?.error) {
      setErreur(r.error);
      setEnCours(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Nouvelle offre</h1>
        <Button asChild variant="ghost" size="sm">
          <Link href="/offres">
            <ArrowLeft className="size-4" />
            Retour à la liste
          </Link>
        </Button>
      </div>

      {erreur && (
        <Alert variant="destructive">
          <AlertDescription>{erreur}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Déposer un document</CardTitle>
          <CardDescription>
            Capture d&apos;écran Sirev, PDF fournisseur, page de circuit exportée.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setSurvol(true);
            }}
            onDragLeave={() => setSurvol(false)}
            onDrop={(e) => {
              e.preventDefault();
              setSurvol(false);
              choisir(e.dataTransfer.files[0]);
            }}
            onClick={() => inputRef.current?.click()}
            className={
              "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-14 text-center transition-colors " +
              (survol
                ? "border-primary bg-primary/5"
                : fichier
                  ? "border-primary/40 bg-muted/40"
                  : "border-input hover:border-primary/50 hover:bg-muted/50")
            }
          >
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept="image/png,image/jpeg,image/webp,application/pdf"
              onChange={(e) => choisir(e.target.files?.[0])}
            />
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              {fichier ? (
                <FileCheck2 className="size-6 text-primary" />
              ) : (
                <UploadCloud className="size-6 text-muted-foreground" />
              )}
            </div>
            {fichier ? (
              <div className="flex flex-col gap-1">
                <span className="font-medium">{fichier.name}</span>
                <span className="text-xs text-muted-foreground">
                  {(fichier.size / 1024 / 1024).toFixed(1)} Mo · clique pour en choisir un autre
                </span>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium">
                  Glisse un fichier ici, ou clique pour choisir
                </span>
                <span className="text-xs text-muted-foreground">
                  PNG, JPG, WEBP jusqu&apos;à 10 Mo · PDF jusqu&apos;à 20 Mo
                </span>
              </div>
            )}
          </div>

          <Button onClick={deposerFichier} disabled={!fichier || enCours} className="w-full">
            {enCours ? "Dépôt en cours…" : "Déposer le fichier"}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-dashed bg-transparent shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-medium">
            <Link2 className="size-4 text-muted-foreground" />
            Depuis une URL
          </CardTitle>
          <CardDescription>
            Page de circuit en ligne : le contenu est récupéré et conservé tel quel.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="url" className="sr-only">
              Adresse de la page
            </Label>
            <Input
              id="url"
              type="url"
              placeholder="https://…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
          <Button
            variant="outline"
            onClick={deposerUrl}
            disabled={!url.trim() || enCours}
            className="w-full"
          >
            {enCours ? "Récupération…" : "Déposer l'URL"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
