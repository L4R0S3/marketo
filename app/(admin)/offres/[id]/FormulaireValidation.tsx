"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, type Control, type UseFormRegister } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  FormulaireOffre,
  formulaireVersVisuel,
  type FormulaireOffreT,
} from "@/lib/schema/formulaire";
import { LIMITES } from "@/lib/templates/social/schema";
import { LIMITES_TEXTE } from "@/lib/composition/schema";
import { NOMS_THEMES } from "@/lib/templates/social/themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApercuPost } from "./ApercuPost";
import { enregistrerOffre, validerOffre, repasserEnBrouillon } from "./actions";

// Écran de validation (phase 3). Volet gauche : le document source (page.tsx).
// Volet droit : ce formulaire, avec l'aperçu du post en direct au-dessus.
// L'admin est laid et c'est voulu (CLAUDE.md §11) : tout l'effort visuel va dans
// les sorties générées.

type Props = {
  offreId: string;
  statut: string;
  defauts: FormulaireOffreT;
  heroUrl: string | null;
  aDesFaits: boolean;
  aDuTexte: boolean;
};

// Compteur de caractères : la seule information vraiment utile à la saisie.
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

function Erreur({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
}

export function FormulaireValidation({
  offreId,
  statut,
  defauts,
  heroUrl,
  aDesFaits,
  aDuTexte,
}: Props) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [erreurIA, setErreurIA] = useState<string | null>(null);
  const [travailIA, setTravailIA] = useState<null | "extraction" | "composition">(null);

  const form = useForm<FormulaireOffreT>({
    resolver: zodResolver(FormulaireOffre),
    defaultValues: defauts,
    mode: "onBlur",
  });
  const { register, control, handleSubmit, watch, reset, formState } = form;

  // La page se recharge après une extraction ou une composition : on réaligne le
  // formulaire sur les nouvelles valeurs serveur.
  useEffect(() => {
    reset(defauts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(defauts)]);

  // watch() re-rend à chaque frappe : c'est exactement ce que veut un aperçu en
  // direct. Le React Compiler est désactivé sur ce projet (CLAUDE.md §2), donc la
  // mise en garde de mémoïsation de la règle ne s'applique pas ici.
  // eslint-disable-next-line react-hooks/incompatible-library
  const valeurs = watch();
  const visuel = formulaireVersVisuel(valeurs, heroUrl ?? "");

  const colonnes = useFieldArray({ control, name: "texte.colonnes" });
  const faq = useFieldArray({ control, name: "texte.faq" });

  async function lancerIA(etape: "extraction" | "composition") {
    setTravailIA(etape);
    setErreurIA(null);
    try {
      const res = await fetch("/api/extraction", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ offreId, etape }),
      });
      const json = await res.json();
      if (!res.ok) setErreurIA(json.error ?? "Échec.");
      else router.refresh();
    } catch (e) {
      setErreurIA(e instanceof Error ? e.message : "Échec réseau.");
    } finally {
      setTravailIA(null);
    }
  }

  function soumettre(action: typeof enregistrerOffre) {
    return handleSubmit((valeursValides) => {
      setMessage(null);
      demarrer(async () => {
        const r = await action(offreId, valeursValides);
        setMessage("error" in r ? r.error : r.message);
        if (!("error" in r)) router.refresh();
      });
    });
  }

  const e = formState.errors;
  const modifiable = statut === "brouillon" || statut === "validee";

  return (
    <form className="flex flex-col gap-6">
      {/* Aperçu en direct */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Aperçu du post</h2>
          <span className="text-xs text-muted-foreground">
            structure seulement — rendu final en phase 4
          </span>
        </div>
        {heroUrl ? null : (
          <p className="text-xs text-amber-600">
            Aucune photo hero : l&apos;aperçu est sur fond neutre, et la validation la
            réclamera.
          </p>
        )}
        <ApercuPost visuel={visuel} />
      </section>

      {/* Actions IA */}
      <section className="flex flex-col gap-2 border-t pt-4">
        <h2 className="text-sm font-semibold">Extraction</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={travailIA !== null}
            onClick={() => lancerIA("extraction")}
          >
            {travailIA === "extraction" ? "Extraction…" : "1. Extraire les faits"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={travailIA !== null || !aDesFaits}
            onClick={() => lancerIA("composition")}
          >
            {travailIA === "composition"
              ? "Composition…"
              : aDuTexte
                ? "2. Régénérer le texte"
                : "2. Composer le texte"}
          </Button>
          <span className="text-xs text-muted-foreground">
            Régénérer le texte ne retouche jamais les faits.
          </span>
        </div>
        {erreurIA && <p className="text-sm text-destructive">{erreurIA}</p>}
      </section>

      {/* ── Faits ── */}
      <section className="flex flex-col gap-3 border-t pt-4">
        <h2 className="text-sm font-semibold">Faits</h2>
        <p className="text-xs text-muted-foreground">
          Vérifie en priorité le prix, la date de départ et l&apos;occupation : ce sont les
          erreurs les plus coûteuses.
        </p>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="prix">Prix par personne *</Label>
            <Input id="prix" {...register("faits.prix_par_personne")} />
            <Erreur message={e.faits?.prix_par_personne?.message} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="devise">Devise</Label>
            <Input id="devise" placeholder="CAD" {...register("faits.devise")} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="occupation">Occupation</Label>
            <select
              id="occupation"
              className="h-9 rounded-md border bg-transparent px-2 text-sm"
              {...register("faits.occupation")}
            >
              <option value="">— non précisée —</option>
              <option value="simple">simple</option>
              <option value="double">double</option>
              <option value="triple">triple</option>
              <option value="quadruple">quadruple</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="depart">Date de départ</Label>
            <Input id="depart" placeholder="AAAA-MM-JJ" {...register("faits.date_depart")} />
            <Erreur message={e.faits?.date_depart?.message} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="retour">Date de retour</Label>
            <Input id="retour" placeholder="AAAA-MM-JJ" {...register("faits.date_retour")} />
            <Erreur message={e.faits?.date_retour?.message} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="taxes">Taxes incluses</Label>
            <select
              id="taxes"
              className="h-9 rounded-md border bg-transparent px-2 text-sm"
              {...register("faits.taxes_incluses")}
            >
              <option value="">— non précisé —</option>
              <option value="oui">oui</option>
              <option value="non">non</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="nuits">Durée (nuits)</Label>
            <Input id="nuits" {...register("faits.duree_nuits")} />
            <Erreur message={e.faits?.duree_nuits?.message} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="jours">Durée (jours)</Label>
            <Input id="jours" {...register("faits.duree_jours")} />
            <Erreur message={e.faits?.duree_jours?.message} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="validite">Prix valide jusqu&apos;au</Label>
            <Input id="validite" placeholder="AAAA-MM-JJ" {...register("faits.prix_valide_jusqua")} />
            <Erreur message={e.faits?.prix_valide_jusqua?.message} />
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="produit">Type de produit</Label>
            <select
              id="produit"
              className="h-9 rounded-md border bg-transparent px-2 text-sm"
              {...register("faits.type_produit")}
            >
              <option value="">— non précisé —</option>
              <option value="forfait">forfait</option>
              <option value="croisiere">croisière</option>
              <option value="circuit">circuit</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="theme_voyage">Thème du voyage</Label>
            <Input id="theme_voyage" {...register("faits.theme_voyage")} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="fournisseur">Fournisseur</Label>
            <Input id="fournisseur" {...register("faits.fournisseur")} />
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="pays">Destination (pays)</Label>
            <Input id="pays" {...register("faits.destination_pays")} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="ville">Destination (ville)</Label>
            <Input id="ville" {...register("faits.destination_ville")} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="compagnie">Compagnie aérienne</Label>
            <Input id="compagnie" {...register("faits.compagnie_aerienne")} />
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="aeroport">Aéroport de départ</Label>
            <Input id="aeroport" placeholder="YUL" {...register("faits.aeroport_depart")} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="alternatifs">Aéroports alternatifs</Label>
            <Input id="alternatifs" placeholder="YQB, YYZ" {...register("faits.aeroports_alternatifs")} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="cabine">Type de cabine / chambre</Label>
            <Input id="cabine" {...register("faits.type_cabine")} />
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="etab">Établissement</Label>
            <Input id="etab" {...register("faits.etablissement_nom")} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="etabtype">Type d&apos;établissement</Label>
            <select
              id="etabtype"
              className="h-9 rounded-md border bg-transparent px-2 text-sm"
              {...register("faits.etablissement_type")}
            >
              <option value="">— non précisé —</option>
              <option value="hotel">hôtel</option>
              <option value="navire">navire</option>
              <option value="multiple">multiple</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="categorie">Catégorie</Label>
            <Input id="categorie" placeholder="3 et 4 étoiles" {...register("faits.etablissement_categorie")} />
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="lienres">Lien de réservation</Label>
            <Input id="lienres" {...register("faits.lien_reservation")} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="lienta">Lien TripAdvisor</Label>
            <Input id="lienta" {...register("faits.lien_tripadvisor")} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="lienmo">Lien Monarc</Label>
            <Input id="lienmo" {...register("faits.lien_monarc")} />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="inclusions">Inclusions (une par ligne)</Label>
            <Textarea id="inclusions" rows={5} {...register("faits.inclusions")} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="exclusions">Exclusions (une par ligne)</Label>
            <Textarea id="exclusions" rows={5} {...register("faits.exclusions")} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="itineraire">Itinéraire (une étape par ligne)</Label>
            <Textarea id="itineraire" rows={5} {...register("faits.itineraire")} />
          </div>
        </div>
      </section>

      {/* ── Texte du visuel ── */}
      <section className="flex flex-col gap-3 border-t pt-4">
        <h2 className="text-sm font-semibold">Texte du post</h2>

        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <Label htmlFor="titre">Titre *</Label>
            <Compteur valeur={valeurs.texte?.titre ?? ""} max={LIMITES.titre} />
          </div>
          <Input id="titre" {...register("texte.titre")} />
          <Erreur message={e.texte?.titre?.message} />
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <Label htmlFor="bandeau">Bandeau</Label>
            <Compteur valeur={valeurs.texte?.bandeau ?? ""} max={LIMITES.bandeau} />
          </div>
          <Input id="bandeau" {...register("texte.bandeau")} />
          <Erreur message={e.texte?.bandeau?.message} />
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

        {/* Prix secondaire = un SUPPLÉMENT, jamais le prix d'une seconde formule */}
        <div className="flex flex-col gap-2 rounded-md border p-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" {...register("texte.prix_secondaire_actif")} />
            Prix secondaire (supplément : plan boissons, wifi…)
          </label>
          {valeurs.texte?.prix_secondaire_actif && (
            <div className="grid gap-2 md:grid-cols-3">
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <Label>Surtitre</Label>
                  <Compteur
                    valeur={valeurs.texte?.prix_secondaire?.surtitre ?? ""}
                    max={LIMITES.surtitre}
                  />
                </div>
                <Input {...register("texte.prix_secondaire.surtitre")} />
              </div>
              <div className="flex flex-col gap-1">
                <Label>Montant</Label>
                <Input {...register("texte.prix_secondaire.montant")} />
                <Erreur message={e.texte?.prix_secondaire?.montant?.message} />
              </div>
              <div className="flex flex-col gap-1">
                <Label>Mentions (une par ligne)</Label>
                <Textarea rows={3} {...register("texte.prix_secondaire.mentions")} />
              </div>
            </div>
          )}
        </div>

        {/* Badge */}
        <div className="flex flex-col gap-2 rounded-md border p-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" {...register("texte.badge_actif")} />
            Badge (départs alternatifs)
          </label>
          {valeurs.texte?.badge_actif && (
            <div className="grid gap-2 md:grid-cols-2">
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <Label>Texte</Label>
                  <Compteur valeur={valeurs.texte?.badge?.texte ?? ""} max={LIMITES.badge} />
                </div>
                <Input {...register("texte.badge.texte")} />
                <Erreur message={e.texte?.badge?.texte?.message} />
              </div>
              <div className="flex flex-col gap-1">
                <Label>Icône (code aéroport)</Label>
                <Input placeholder="yqb" {...register("texte.badge.icone")} />
              </div>
            </div>
          )}
        </div>

        {/* Habillage : décision de l'opérateur, jamais du modèle */}
        <div className="grid gap-3 md:grid-cols-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="theme">Thème de couleur</Label>
            <select
              id="theme"
              className="h-9 rounded-md border bg-transparent px-2 text-sm"
              {...register("habillage.theme")}
            >
              {NOMS_THEMES.map((t) => (
                <option key={t.valeur} value={t.valeur}>
                  {t.nom}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="focale">Cadrage de la photo</Label>
            <select
              id="focale"
              className="h-9 rounded-md border bg-transparent px-2 text-sm"
              {...register("habillage.focale")}
            >
              <option value="haut">haut</option>
              <option value="centre">centre</option>
              <option value="bas">bas</option>
            </select>
          </div>
        </div>
      </section>

      {/* ── Accroche et FAQ (landing page + publication) ── */}
      <section className="flex flex-col gap-3 border-t pt-4">
        <h2 className="text-sm font-semibold">Accroche et FAQ</h2>
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <Label htmlFor="accroche">Accroche du post</Label>
            <Compteur valeur={valeurs.texte?.accroche ?? ""} max={LIMITES_TEXTE.accroche} />
          </div>
          <Textarea id="accroche" rows={4} {...register("texte.accroche")} />
          <Erreur message={e.texte?.accroche?.message} />
        </div>

        {faq.fields.map((champ, i) => (
          <div key={champ.id} className="flex flex-col gap-1 rounded-md border p-3">
            <div className="flex items-center justify-between">
              <Label>Question {i + 1}</Label>
              <div className="flex items-center gap-2">
                <Compteur valeur={valeurs.texte?.faq?.[i]?.q ?? ""} max={LIMITES_TEXTE.question} />
                <Button type="button" variant="ghost" size="sm" onClick={() => faq.remove(i)}>
                  Retirer
                </Button>
              </div>
            </div>
            <Input {...register(`texte.faq.${i}.q`)} />
            <Erreur message={e.texte?.faq?.[i]?.q?.message} />
            <Textarea rows={2} {...register(`texte.faq.${i}.r`)} />
            <Erreur message={e.texte?.faq?.[i]?.r?.message} />
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
      </section>

      {/* ── Enregistrement et validation ── */}
      <section className="sticky bottom-0 flex flex-col gap-2 border-t bg-background py-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" disabled={enCours || !modifiable} onClick={soumettre(enregistrerOffre)}>
            Enregistrer
          </Button>
          <Button
            type="button"
            variant="default"
            disabled={enCours || !modifiable}
            onClick={soumettre(validerOffre)}
          >
            {statut === "validee" ? "Revalider" : "Valider l'offre"}
          </Button>
          {statut === "validee" && (
            <Button
              type="button"
              variant="ghost"
              disabled={enCours}
              onClick={() =>
                demarrer(async () => {
                  const r = await repasserEnBrouillon(offreId);
                  setMessage("error" in r ? r.error : r.message);
                  router.refresh();
                })
              }
            >
              Repasser en brouillon
            </Button>
          )}
          {!modifiable && (
            <span className="text-xs text-muted-foreground">
              Offre {statut} : lecture seule ici.
            </span>
          )}
        </div>
        {message && <p className="text-sm">{message}</p>}
        {formState.isSubmitted && !formState.isValid && (
          <p className="text-sm text-destructive">
            Le formulaire contient des erreurs : elles sont signalées sous les champs
            concernés.
          </p>
        )}
      </section>
    </form>
  );
}

// Une colonne du visuel : en-tête, blocs (1 à 4, chacun de 1 ou 2 lignes) et prix.
function ColonneEdit({
  index,
  control,
  register,
  valeurs,
  supprimable,
  onSupprimer,
}: {
  index: number;
  control: Control<FormulaireOffreT>;
  register: UseFormRegister<FormulaireOffreT>;
  valeurs: FormulaireOffreT;
  supprimable: boolean;
  onSupprimer: () => void;
}) {
  const blocs = useFieldArray({ control, name: `texte.colonnes.${index}.blocs` });
  const col = valeurs.texte?.colonnes?.[index];

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">
          Colonne {index + 1}
          {valeurs.texte?.colonnes?.length === 2 ? " (comparaison)" : ""}
        </h3>
        {supprimable && (
          <Button type="button" variant="ghost" size="sm" onClick={onSupprimer}>
            Retirer la colonne
          </Button>
        )}
      </div>

      {valeurs.texte?.colonnes?.length === 2 && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <Label>En-tête</Label>
            <Compteur valeur={col?.entete ?? ""} max={LIMITES.entete} />
          </div>
          <Input {...register(`texte.colonnes.${index}.entete`)} />
        </div>
      )}

      {blocs.fields.map((champ, j) => {
        const texte = col?.blocs?.[j]?.texte ?? "";
        const lignes = texte.split("\n");
        return (
          <div key={champ.id} className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <Label>Bloc {j + 1} — une ligne du visuel par ligne de texte</Label>
              <div className="flex items-center gap-2">
                {lignes.map((l, k) => (
                  <Compteur key={k} valeur={l} max={LIMITES.ligne} />
                ))}
                {blocs.fields.length > 1 && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => blocs.remove(j)}>
                    Retirer
                  </Button>
                )}
              </div>
            </div>
            <Textarea rows={2} {...register(`texte.colonnes.${index}.blocs.${j}.texte`)} />
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

      <div className="grid gap-2 md:grid-cols-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <Label>Surtitre du prix</Label>
            <Compteur valeur={col?.surtitre ?? ""} max={LIMITES.surtitre} />
          </div>
          <Input {...register(`texte.colonnes.${index}.surtitre`)} />
        </div>
        <div className="flex flex-col gap-1">
          <Label>Montant affiché</Label>
          <Input {...register(`texte.colonnes.${index}.montant`)} />
        </div>
        <div className="flex flex-col gap-1">
          <Label>Mentions (une par ligne)</Label>
          <Textarea rows={3} {...register(`texte.colonnes.${index}.mentions`)} />
        </div>
      </div>
    </div>
  );
}
