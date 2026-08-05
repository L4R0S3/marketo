"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FaitsForm, type FaitsFormT } from "@/lib/schema/formulaire";
import { lancerEtapeIA } from "@/lib/extraction/appelClient";
import { ChevronDown, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
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
  // Suggestion affichée en filigrane. Depuis la migration 0005, la base ne pose
  // plus de défaut 'YUL'/'CAD' : un champ vide veut dire « le document ne le dit
  // pas ». On le suggère, on ne le pré-remplit pas.
  placeholder?: string;
};

const CRITIQUES: Champ[] = [
  {
    cle: "prix_par_personne",
    label: "Prix par personne",
    aide: "TOTAL taxes incluses — c'est le seul montant affiché sur le post",
  },
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
  { cle: "prix_base", label: "Prix avant taxes", aide: "détail du document, jamais affiché" },
  { cle: "taxes", label: "Taxes", aide: "détail du document, jamais affiché" },
  {
    cle: "prix_avant_rabais",
    label: "Prix avant rabais",
    aide: "tarif régulier ; s'affiche barré dans le courriel",
  },
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
  { cle: "devise", label: "Devise", placeholder: "CAD ?" },
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
  {
    cle: "aeroport_depart",
    label: "Aéroport de départ",
    placeholder: "YUL — Montréal ?",
    aide: "vide = le document ne le mentionne pas ; ne le devine pas",
  },
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
    const erreur = await lancerEtapeIA(offreId, "extraction");
    if (erreur) {
      setErreurIA(erreur);
      setExtraction("attente");
    } else {
      setExtraction("faite");
      router.refresh();
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
            placeholder={c.placeholder}
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
      <Card className="lg:sticky lg:top-20 lg:self-start">
        <CardHeader>
          <CardTitle className="text-base">Document source</CardTitle>
          {source.lien && (
            <CardDescription className="break-all">
              <a href={source.lien} target="_blank" rel="noreferrer" className="underline">
                {source.lien}
              </a>
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {source.url ? (
            source.type === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={source.url}
                alt="Document source"
                className="max-h-[75vh] w-auto rounded-md border"
              />
            ) : (
              <iframe
                src={source.url}
                className="h-[75vh] w-full rounded-md border"
                title="Document source"
              />
            )
          ) : (
            <p className="text-sm text-muted-foreground">Aucun document source.</p>
          )}
        </CardContent>
      </Card>

      {/* Volet droit : les faits */}
      {/* onSubmit neutralisé : aucun bouton n'est de type submit ici, mais la
          touche Entrée dans un champ déclencherait une soumission implicite —
          donc un rechargement de page et la perte des corrections en cours. */}
      <form className="flex flex-col gap-5" onSubmit={(ev) => ev.preventDefault()}>
        {extraction === "encours" && (
          <Alert>
            <AlertTitle>Extraction en cours</AlertTitle>
            <AlertDescription>
              Le modèle lit le document — une vingtaine de secondes.
            </AlertDescription>
          </Alert>
        )}
        {erreurIA && (
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertTitle>Extraction impossible</AlertTitle>
            <AlertDescription>
              <span>{erreurIA}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={lancerExtraction}
              >
                Relancer l&apos;extraction
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>Vérifie ces trois champs contre le document</AlertTitle>
          <AlertDescription>
            <span>
              Prix, date de départ et occupation sont les erreurs les plus coûteuses : une
              cabine solo et une cabine double n&apos;ont pas le même prix par personne.
            </span>
            {/* Les champs eux-mêmes reprennent la couleur normale : l'alerte
                attire l'œil, elle ne doit pas rendre la saisie illisible. */}
            <div className="mt-3 grid w-full gap-3 text-foreground sm:grid-cols-3">
              {CRITIQUES.map((c) => champ(c, true))}
            </div>
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Extrait du document</CardTitle>
            <CardDescription>
              {`${remplis.length} champ${remplis.length > 1 ? "s" : ""} renseigné${
                remplis.length > 1 ? "s" : ""
              } par l'extraction.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {remplis.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2">{remplis.map((c) => champ(c))}</div>
            )}

            <Separator />

            <div className="grid gap-3 sm:grid-cols-3">{LISTES.map((c) => champ(c))}</div>

            {vides.length > 0 && (
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="group w-full justify-between text-muted-foreground"
                  >
                    {`${vides.length} champs non renseignés par l'extraction`}
                    <ChevronDown className="size-4 transition-transform group-data-[state=open]:rotate-180" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {vides.map((c) => champ(c))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </CardContent>
        </Card>

        <div className="sticky bottom-0 flex flex-col gap-2 border-t bg-background/95 py-4 backdrop-blur">
          <Button
            type="button"
            size="lg"
            className="w-full"
            onClick={confirmer}
            disabled={enCours || !modifiable}
          >
            Faits confirmés →
          </Button>
          {!modifiable && (
            <span className="text-center text-xs text-muted-foreground">
              Offre déjà validée : repasse-la en brouillon pour corriger les faits.
            </span>
          )}
          {message && <p className="text-sm text-destructive">{message}</p>}
        </div>
      </form>
    </div>
  );
}
