"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, type Control, type UseFormRegister } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  VisuelForm,
  visuelFormVersPostVisuel,
  type VisuelFormT,
} from "@/lib/schema/formulaire";
import { LIMITES } from "@/lib/templates/social/schema";
import { LIMITES_TEXTE } from "@/lib/composition/schema";
import { THEMES, NOMS_THEMES } from "@/lib/templates/social/themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PhotosSection } from "../PhotosSection";
import { ApercuPost } from "../ApercuPost";
import { enregistrerVisuel, validerOffre } from "../actions";

// Étape 3 du flux. L'aperçu occupe le volet gauche, en grand ; tout ce qui se
// règle est à droite. Le texte vient de l'Appel 2 et reste éditable ici.

type Photo = { id: string; role: string; publicUrl: string };

function Compteur({ valeur, max }: { valeur: string; max: number }) {
  const n = valeur?.length ?? 0;
  return (
    <span
      className={
        n > max
          ? "text-xs font-semibold text-destructive"
          : n > max - 5
            ? "text-xs text-amber-600"
            : "text-xs text-muted-foreground"
      }
    >
      {n}/{max}
    </span>
  );
}

export function EtapeVisuel({
  offreId,
  defauts,
  photos,
  heroUrl,
  aDuTexte,
  erreurComposition,
  statut,
}: {
  offreId: string;
  defauts: VisuelFormT;
  photos: Photo[];
  heroUrl: string | null;
  aDuTexte: boolean;
  erreurComposition: string | null;
  statut: string;
}) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [composition, setComposition] = useState<"attente" | "encours" | "faite">(
    aDuTexte ? "faite" : "attente",
  );
  const [erreurIA, setErreurIA] = useState<string | null>(erreurComposition);
  const lancee = useRef(false);

  const form = useForm<VisuelFormT>({
    resolver: zodResolver(VisuelForm),
    defaultValues: defauts,
    mode: "onBlur",
  });
  const { register, control, handleSubmit, watch, reset, setValue, formState } = form;

  useEffect(() => {
    reset(defauts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(defauts)]);

  // eslint-disable-next-line react-hooks/incompatible-library
  const valeurs = watch();
  const visuel = visuelFormVersPostVisuel(valeurs, heroUrl ?? "");
  const colonnes = useFieldArray({ control, name: "colonnes" });
  const faq = useFieldArray({ control, name: "faq" });

  async function composer() {
    setComposition("encours");
    setErreurIA(null);
    try {
      const res = await fetch("/api/extraction", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ offreId, etape: "composition" }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErreurIA(json.error ?? "Composition échouée.");
        setComposition("attente");
      } else {
        setComposition("faite");
        router.refresh();
      }
    } catch (e) {
      setErreurIA(e instanceof Error ? e.message : "Échec réseau.");
      setComposition("attente");
    }
  }

  // Premier passage : le texte se compose tout seul, l'opérateur arrive devant
  // un post déjà rédigé.
  useEffect(() => {
    if (!aDuTexte && !erreurComposition && !lancee.current) {
      lancee.current = true;
      void composer();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function soumettre(action: typeof enregistrerVisuel, apres?: () => void) {
    return handleSubmit((valides) => {
      setMessage(null);
      demarrer(async () => {
        const r = await action(offreId, valides);
        if ("error" in r) setMessage(r.error);
        else {
          setMessage(null);
          if (apres) apres();
          else router.refresh();
        }
      });
    });
  }

  const e = formState.errors;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,560px)_minmax(0,1fr)]">
      {/* Volet gauche : l'aperçu, en grand */}
      <div className="flex flex-col gap-2 lg:sticky lg:top-4 lg:self-start">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Aperçu</h2>
          <span className="text-xs text-muted-foreground">
            structure — le PNG final est rendu à l&apos;étape suivante
          </span>
        </div>
        <ApercuPost visuel={visuel} echelle={0.5} />
        {!heroUrl && (
          <p className="text-xs text-amber-600">
            Aucune photo hero : choisis-en une ci-contre, elle est obligatoire pour valider.
          </p>
        )}
      </div>

      {/* Volet droit : les contrôles */}
      <form className="flex flex-col gap-5">
        {composition === "encours" && (
          <p className="rounded-md border border-dashed p-3 text-sm">
            Composition du texte en cours — une quinzaine de secondes.
          </p>
        )}
        {erreurIA && (
          <div className="flex flex-col gap-2 rounded-md border border-destructive p-3">
            <p className="text-sm text-destructive">{erreurIA}</p>
            <div>
              <Button type="button" variant="secondary" size="sm" onClick={composer}>
                Relancer la composition
              </Button>
            </div>
          </div>
        )}

        {/* Photo */}
        <section className="flex flex-col gap-2 rounded-md border p-3">
          <PhotosSection offreId={offreId} photos={photos} />
        </section>

        {/* Habillage */}
        <section className="flex flex-col gap-3 rounded-md border p-3">
          <div className="flex flex-col gap-2">
            <Label>Thème</Label>
            <div className="flex flex-wrap gap-2">
              {NOMS_THEMES.map((t) => {
                const actif = valeurs.theme === t.valeur;
                return (
                  <button
                    key={t.valeur}
                    type="button"
                    title={t.nom}
                    onClick={() => setValue("theme", t.valeur, { shouldDirty: true })}
                    className={
                      "h-9 w-9 rounded-full border-2 " +
                      (actif ? "border-foreground ring-2 ring-foreground/30" : "border-transparent")
                    }
                    style={{
                      background: `linear-gradient(135deg, ${THEMES[t.valeur].cadreDe}, ${THEMES[t.valeur].cadreVers})`,
                    }}
                  />
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Cadrage de la photo</Label>
            <div className="flex gap-2">
              {(["haut", "centre", "bas"] as const).map((f) => (
                <Button
                  key={f}
                  type="button"
                  size="sm"
                  variant={valeurs.focale === f ? "default" : "outline"}
                  onClick={() => setValue("focale", f, { shouldDirty: true })}
                >
                  {f}
                </Button>
              ))}
            </div>
          </div>
        </section>

        {/* Texte du visuel */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Texte du post</h2>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={composition === "encours"}
              onClick={composer}
            >
              {composition === "encours" ? "Composition…" : "Régénérer le texte"}
            </Button>
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <Label htmlFor="titre">Titre</Label>
              <Compteur valeur={valeurs.titre ?? ""} max={LIMITES.titre} />
            </div>
            <Input id="titre" {...register("titre")} />
            {e.titre && <p className="text-xs text-destructive">{e.titre.message}</p>}
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <Label htmlFor="bandeau">Bandeau</Label>
              <Compteur valeur={valeurs.bandeau ?? ""} max={LIMITES.bandeau} />
            </div>
            <Input id="bandeau" {...register("bandeau")} />
            {e.bandeau && <p className="text-xs text-destructive">{e.bandeau.message}</p>}
          </div>

          {colonnes.fields.map((champ, i) => (
            <ColonneEdit
              key={champ.id}
              index={i}
              control={control}
              register={register}
              valeurs={valeurs}
              supprimable={colonnes.fields.length > 1}
              onSupprimer={() => colonnes.remove(i)}
            />
          ))}

          {colonnes.fields.length < LIMITES.colonnes && (
            <div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  colonnes.append({
                    entete: "",
                    blocs: [{ texte: "" }],
                    surtitre: "À partir de seulement",
                    montant: "",
                    mentions: "",
                  })
                }
              >
                Ajouter la seconde colonne (comparaison)
              </Button>
            </div>
          )}

          <div className="flex flex-col gap-2 rounded-md border p-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" {...register("prix_secondaire_actif")} />
              Prix secondaire (supplément : plan boissons, wifi…)
            </label>
            {valeurs.prix_secondaire_actif && (
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <Label>Surtitre</Label>
                    <Compteur
                      valeur={valeurs.prix_secondaire?.surtitre ?? ""}
                      max={LIMITES.surtitre}
                    />
                  </div>
                  <Input {...register("prix_secondaire.surtitre")} />
                </div>
                <div className="flex flex-col gap-1">
                  <Label>Montant</Label>
                  <Input {...register("prix_secondaire.montant")} />
                </div>
                <div className="flex flex-col gap-1">
                  <Label>Mentions (une par ligne)</Label>
                  <Textarea rows={3} {...register("prix_secondaire.mentions")} />
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 rounded-md border p-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" {...register("badge_actif")} />
              Badge (départs alternatifs)
            </label>
            {valeurs.badge_actif && (
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <Label>Texte</Label>
                    <Compteur valeur={valeurs.badge?.texte ?? ""} max={LIMITES.badge} />
                  </div>
                  <Input {...register("badge.texte")} />
                </div>
                <div className="flex flex-col gap-1">
                  <Label>Icône (code aéroport)</Label>
                  <Input placeholder="yqb" {...register("badge.icone")} />
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Texte de publication et FAQ : utiles à l'étape suivante et à la landing page */}
        <details className="rounded-md border p-3">
          <summary className="cursor-pointer text-sm font-semibold">
            Texte de publication et FAQ
          </summary>
          <div className="mt-3 flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <Label htmlFor="accroche">Accroche (texte du post)</Label>
                <Compteur valeur={valeurs.accroche ?? ""} max={LIMITES_TEXTE.accroche} />
              </div>
              <Textarea id="accroche" rows={4} {...register("accroche")} />
            </div>

            {faq.fields.map((champ, i) => (
              <div key={champ.id} className="flex flex-col gap-1 rounded-md border p-2">
                <div className="flex items-center justify-between">
                  <Label>Question {i + 1}</Label>
                  <Button type="button" variant="ghost" size="sm" onClick={() => faq.remove(i)}>
                    Retirer
                  </Button>
                </div>
                <Input {...register(`faq.${i}.q`)} />
                <Textarea rows={2} {...register(`faq.${i}.r`)} />
              </div>
            ))}
            <div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => faq.append({ q: "", r: "" })}
              >
                Ajouter une question
              </Button>
            </div>
          </div>
        </details>

        {/* Barre d'action */}
        <div className="sticky bottom-0 flex flex-col gap-2 border-t bg-background py-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              disabled={enCours}
              onClick={soumettre(validerOffre, () => router.push(`/offres/${offreId}/sorties`))}
            >
              Valider et télécharger
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={enCours}
              onClick={soumettre(enregistrerVisuel)}
            >
              Enregistrer sans valider
            </Button>
            {statut !== "brouillon" && (
              <span className="text-xs text-muted-foreground">Offre déjà {statut}.</span>
            )}
          </div>
          {message && <p className="text-sm text-destructive">{message}</p>}
        </div>
      </form>
    </div>
  );
}

// Une colonne du visuel : en-tête, blocs (1 à 4, de 1 ou 2 lignes) et prix.
function ColonneEdit({
  index,
  control,
  register,
  valeurs,
  supprimable,
  onSupprimer,
}: {
  index: number;
  control: Control<VisuelFormT>;
  register: UseFormRegister<VisuelFormT>;
  valeurs: VisuelFormT;
  supprimable: boolean;
  onSupprimer: () => void;
}) {
  const blocs = useFieldArray({ control, name: `colonnes.${index}.blocs` });
  const col = valeurs.colonnes?.[index];
  const double = (valeurs.colonnes?.length ?? 1) === 2;

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">
          Colonne {index + 1}
          {double ? " (comparaison)" : ""}
        </h3>
        {supprimable && (
          <Button type="button" variant="ghost" size="sm" onClick={onSupprimer}>
            Retirer
          </Button>
        )}
      </div>

      {double && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <Label>En-tête</Label>
            <Compteur valeur={col?.entete ?? ""} max={LIMITES.entete} />
          </div>
          <Input {...register(`colonnes.${index}.entete`)} />
        </div>
      )}

      {blocs.fields.map((champ, j) => {
        const texte = col?.blocs?.[j]?.texte ?? "";
        return (
          <div key={champ.id} className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <Label>Bloc {j + 1} — une ligne du visuel par ligne de texte</Label>
              <div className="flex items-center gap-2">
                {texte.split("\n").map((l, k) => (
                  <Compteur key={k} valeur={l} max={LIMITES.ligne} />
                ))}
                {blocs.fields.length > 1 && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => blocs.remove(j)}>
                    Retirer
                  </Button>
                )}
              </div>
            </div>
            <Textarea rows={2} {...register(`colonnes.${index}.blocs.${j}.texte`)} />
          </div>
        );
      })}

      {blocs.fields.length < LIMITES.blocs && (
        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => blocs.append({ texte: "" })}
          >
            Ajouter un bloc
          </Button>
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <Label>Surtitre du prix</Label>
            <Compteur valeur={col?.surtitre ?? ""} max={LIMITES.surtitre} />
          </div>
          <Input {...register(`colonnes.${index}.surtitre`)} />
        </div>
        <div className="flex flex-col gap-1">
          <Label>Montant affiché</Label>
          <Input {...register(`colonnes.${index}.montant`)} />
        </div>
        <div className="flex flex-col gap-1">
          <Label>Mentions (une par ligne)</Label>
          <Textarea rows={3} {...register(`colonnes.${index}.mentions`)} />
        </div>
      </div>
    </div>
  );
}
