"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  creerOffreDepuisFichier,
  creerOffreDepuisUrl,
} from "@/app/(admin)/offres/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
    <div className="flex max-w-xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Nouvelle offre</h1>
        <Link href="/offres" className="text-sm text-muted-foreground underline">
          Retour à la liste
        </Link>
      </div>

      {/* Glisser-déposer */}
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
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-10 text-center text-sm ${
          survol ? "border-primary bg-muted" : "border-input"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept="image/png,image/jpeg,image/webp,application/pdf"
          onChange={(e) => choisir(e.target.files?.[0])}
        />
        {fichier ? (
          <span className="font-medium">{fichier.name}</span>
        ) : (
          <>
            <span>Glisse un fichier ici, ou clique pour choisir</span>
            <span className="text-muted-foreground">
              PNG, JPG, WEBP (10 Mo) · PDF (20 Mo)
            </span>
          </>
        )}
      </div>

      <Button onClick={deposerFichier} disabled={!fichier || enCours}>
        {enCours ? "Dépôt en cours…" : "Déposer le fichier"}
      </Button>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> ou <span className="h-px flex-1 bg-border" />
      </div>

      {/* URL */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="url">Depuis une URL (page de circuit, etc.)</Label>
        <Input
          id="url"
          type="url"
          placeholder="https://…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <Button
          variant="outline"
          onClick={deposerUrl}
          disabled={!url.trim() || enCours}
        >
          {enCours ? "Récupération…" : "Déposer l'URL"}
        </Button>
      </div>

      {erreur && <p className="text-sm text-red-600">{erreur}</p>}
    </div>
  );
}
