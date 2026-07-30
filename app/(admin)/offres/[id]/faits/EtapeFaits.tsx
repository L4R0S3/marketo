"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FaitsForm, type FaitsFormT } from "@/lib/schema/formulaire";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { enregistrerFaits } from "../actions";

// Étape 2 du flux. Formulaire COURT : on n'affiche que ce que l'IA a rempli, plus
// les trois champs les plus coûteux, toujours visibles et en gros. Le reste vit
// dans un repli, pour ne pas noyer l'opérateur sous trente champs vides.

type Cle = keyof FaitsFormT;
type Champ = {
  cle: Cle;
  label: string;
  type?: "texte" | "liste" | "select";
  options?: { valeur: string; nom: string }[];
  aide?: string;
};

const CRITIQUES: Champ[] = [
  { cle: "prix_par_personne", label: "Prix par personne", aide: "sans symbole, ex. 2599" },
  { cle: "date_depart", label: "Date de départ", aide: "AAAA-MM-JJ, vide si départs multiples" },
  {
    cle: "occupation",
    label: "Occupation",
    type: "select",
    options: [
      { valeur: "", nom: "— non précisée —" },
      { valeur: "simple", nom: "simple" },
      { valeur: "double", nom: "double" },
      { valeur: "triple", nom: "triple" },
      { valeur: "quadruple", nom: "quadruple" },
    ],
  },
];

const AUTRES: Champ[] = [
  { cle: "theme_voyage", label: "Thème du voyage" },
  {
    cle: "type_produit",
    label: "Type de produit",
    type: "select",
    options: [
      { valeur: "", nom: "— non précisé —" },
      { valeur: "forfait", nom: "forfait" },
      { valeur: "croisiere", nom: "croisière" },
      { valeur: "circuit", nom: "circuit" },
    ],
  },
  { cle: "devise", label: "Devise" },
  {
    cle: "taxes_incluses",
    label: "Taxes incluses",
    type: "select",
    options: [
      { valeur: "", nom: "— non précisé —" },
      { valeur: "oui", nom: "oui" },
      { valeur: "non", nom: "non" },
    ],
  },
  { cle: "date_retour", label: "Date de retour" },
  { cle: "duree_nuits", label: "Durée (nuits)" },
  { cle: "duree_jours", label: "Durée (jours)" },
  { cle: "prix_valide_jusqua", label: "Prix valide jusqu'au" },
  { cle: "fournisseur", label: "Fournisseur" },
  { cle: "destination_pays", label: "Destination (pays)" },
  { cle: "destination_ville", label: "Destination (ville)" },
  { cle: "compagnie_aerienne", label: "Compagnie aérienne" },
  { cle: "aeroport_depart", label: "Aéroport de départ" },
  { cle: "aeroports_alternatifs", label: "Aéroports alternatifs", aide: "séparés par des virgules" },
  { cle: "etablissement_nom", label: "Établissement" },
  {
    cle: "etablissement_type",
    label: "Type d'établissement",
    type: "select",
    options: [
      { valeur: "", nom: "— non précisé —" },
      { valeur: "hotel", nom: "hôtel" },
      { valeur: "navire", nom: "navire" },
      { valeur: "multiple", nom: "multiple" },
    ],
  },
  { cle: "etablissement_categorie", label: "Catégorie" },
  { cle: "type_cabine", label: "Type de cabine / chambre" },
  { cle: "lien_reservation", label: "Lien de réservation" },
  { cle: "lien_tripadvisor", label: "Lien TripAdvisor" },
  { cle: "lien_monarc", label: "Lien Monarc" },
];

const LISTES: Champ[] = [
  { cle: "inclusions", label: "Inclusions", type: "liste" },
  { cle: "exclusions", label: "Exclusions", type: "liste" },
  { cle: "itineraire", label: "Itinéraire", type: "liste" },
];

export function EtapeFaits({
  offreId,
  defauts,
  aDesFaits,
  erreurExtraction,
  source,
  modifiable,
}: {
  offreId: string;
  defauts: FaitsFormT;
  aDesFaits: boolean;
  erreurExtraction: string | null;
  source: { url: string | null; type: "image" | "pdf" | "html" | null; lien: string | null };
  modifiable: boolean;
}) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [extraction, setExtraction] = useState<"attente" | "encours" | "faite">(
    aDesFaits ? "faite" : "attente",
  );
  const [erreurIA, setErreurIA] = useState<string | null>(erreurExtraction);
  const lancee = useRef(false);

  const form = useForm<FaitsFormT>({
    resolver: zodResolver(FaitsForm),
    defaultValues: defauts,
    mode: "onBlur",
  });
  const { register, handleSubmit, reset, formState, watch } = form;

  useEffect(() => {
    reset(defauts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(defauts)]);

  async function lancerExtraction() {
    setExtraction("encours");
    setErreurIA(null);
    try {
      const res = await fetch("/api/extraction", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ offreId, etape: "extraction" }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErreurIA(json.error ?? "Extraction échouée.");
        setExtraction("attente");
      } else {
        setExtraction("faite");
        router.refresh();
      }
    } catch (e) {
      setErreurIA(e instanceof Error ? e.message : "Échec réseau.");
      setExtraction("attente");
    }
  }

  // Lancement automatique au premier affichage : l'opérateur vient de déposer un
  // document, il n'a rien à cliquer pour que l'extraction démarre.
  useEffect(() => {
    if (!aDesFaits && !erreurExtraction && !lancee.current) {
      lancee.current = true;
      void lancerExtraction();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // eslint-disable-next-line react-hooks/incompatible-library
  const valeurs = watch();
  const rempli = (c: Champ) => (valeurs[c.cle] ?? "").toString().trim() !== "";
  const remplis = AUTRES.filter(rempli);
  const vides = AUTRES.filter((c) => !rempli(c));

  function champ(c: Champ, gros = false) {
    const erreur = formState.errors[c.cle]?.message as string | undefined;
    return (
      <div key={c.cle} className="flex flex-col gap-1">
        <Label htmlFor={c.cle} className={gros ? "text-sm font-semibold" : undefined}>
          {c.label}
        </Label>
        {c.type === "select" ? (
          <select
            id={c.cle}
            className={
              "rounded-md border bg-transparent px-2 " + (gros ? "h-12 text-lg" : "h-9 text-sm")
            }
            {...register(c.cle)}
          >
            {c.options!.map((o) => (
              <option key={o.valeur} value={o.valeur}>
                {o.nom}
              </option>
            ))}
          </select>
        ) : c.type === "liste" ? (
          <Textarea id={c.cle} rows={5} {...register(c.cle)} />
        ) : (
          <Input
            id={c.cle}
            className={gros ? "h-12 text-lg font-semibold" : undefined}
            {...register(c.cle)}
          />
        )}
        {c.aide && <p className="text-xs text-muted-foreground">{c.aide}</p>}
        {erreur && <p className="text-xs text-destructive">{erreur}</p>}
      </div>
    );
  }

  const confirmer = handleSubmit((valides) => {
    setMessage(null);
    demarrer(async () => {
      const r = await enregistrerFaits(offreId, valides);
      if ("error" in r) setMessage(r.error);
      else router.push(`/offres/${offreId}/visuel`);
    });
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* Volet gauche : la source */}
      <div className="flex flex-col gap-2 lg:sticky lg:top-4 lg:self-start">
        <h2 className="text-sm font-semibold">Document source</h2>
        {source.lien && (
          <p className="text-sm break-all">
            URL :{" "}
            <a href={source.lien} target="_blank" rel="noreferrer" className="underline">
              {source.lien}
            </a>
          </p>
        )}
        {source.url ? (
          source.type === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={source.url} alt="Document source" className="max-h-[80vh] w-auto rounded-md border" />
          ) : (
            <iframe src={source.url} className="h-[80vh] w-full rounded-md border" title="Document source" />
          )
        ) : (
          <p className="text-sm text-muted-foreground">Aucun document source.</p>
        )}
      </div>

      {/* Volet droit : les faits */}
      <form className="flex flex-col gap-5">
        {extraction === "encours" && (
          <p className="rounded-md border border-dashed p-3 text-sm">
            Extraction en cours — le modèle lit le document, une quinzaine de secondes.
          </p>
        )}
        {erreurIA && (
          <div className="flex flex-col gap-2 rounded-md border border-destructive p-3">
            <p className="text-sm text-destructive">{erreurIA}</p>
            <div>
              <Button type="button" variant="secondary" size="sm" onClick={lancerExtraction}>
                Relancer l&apos;extraction
              </Button>
            </div>
          </div>
        )}

        <div className="rounded-md border border-destructive/60 bg-destructive/5 p-3">
          <p className="text-sm font-medium text-destructive">
            Vérifie ces trois champs contre le document.
          </p>
          <p className="text-xs text-muted-foreground">
            Prix, date de départ et occupation sont les erreurs les plus coûteuses : une
            cabine solo et une cabine double n&apos;ont pas le même prix par personne.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">{CRITIQUES.map((c) => champ(c, true))}</div>
        </div>

        {remplis.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold">Extrait du document</h2>
            <div className="grid gap-3 sm:grid-cols-2">{remplis.map((c) => champ(c))}</div>
          </section>
        )}

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">Listes</h2>
          <div className="grid gap-3 sm:grid-cols-3">{LISTES.map((c) => champ(c))}</div>
        </section>

        {vides.length > 0 && (
          <details className="rounded-md border p-3">
            <summary className="cursor-pointer text-sm text-muted-foreground">
              {vides.length} champs non renseignés par l&apos;extraction
            </summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">{vides.map((c) => champ(c))}</div>
          </details>
        )}

        <div className="sticky bottom-0 flex flex-col gap-2 border-t bg-background py-3">
          <div className="flex items-center gap-3">
            <Button type="button" onClick={confirmer} disabled={enCours || !modifiable}>
              Faits confirmés →
            </Button>
            {!modifiable && (
              <span className="text-xs text-muted-foreground">
                Offre déjà validée : repasse-la en brouillon pour corriger les faits.
              </span>
            )}
          </div>
          {message && <p className="text-sm text-destructive">{message}</p>}
        </div>
      </form>
    </div>
  );
}
