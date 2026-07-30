import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  CalendarDays,
  Check,
  Mail,
  MapPin,
  Minus,
  Phone,
  Plane,
  Ship,
  Ticket,
} from "lucide-react";
import { creerClientPublic, urlPhoto } from "@/lib/supabase/public";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { AGENCE, COURRIEL, MARQUE, TELEPHONE } from "@/lib/marque";

// Landing page publique d'une offre. Non transactionnelle : elle donne assez
// d'information pour décrocher le téléphone, rien de plus.
//
// Rendue statiquement à partir de la vue offres_publiques (jamais la table
// offres : la vue est le seul chemin ouvert au rôle anon, et elle ne montre que
// le statut « publiee »). La revalidation est à la demande — c'est la mise en
// publication, codée plus tard, qui déclenchera revalidatePath.

export const revalidate = false;
export const dynamicParams = true;

type OffrePublique = {
  id: string;
  slug: string;
  type_produit: string | null;
  destination_pays: string | null;
  destination_ville: string | null;
  date_depart: string | null;
  date_retour: string | null;
  duree_nuits: number | null;
  duree_jours: number | null;
  prix_par_personne: number | null;
  devise: string | null;
  occupation: string | null;
  taxes_incluses: boolean | null;
  compagnie_aerienne: string | null;
  aeroport_depart: string | null;
  etablissement_nom: string | null;
  etablissement_type: string | null;
  etablissement_categorie: string | null;
  type_cabine: string | null;
  lien_reservation: string | null;
  contenus: {
    fr?: {
      titre?: string;
      accroche?: string;
      inclusions?: string[];
      exclusions?: string[];
      itineraire?: { jour?: number; titre?: string; texte?: string }[];
      faq?: { q?: string; r?: string }[];
      visuel?: { colonnes?: { prix?: { mentions?: string[] } }[] };
    } | null;
  } | null;
};

const CHAMPS =
  "id, slug, type_produit, destination_pays, destination_ville, date_depart, date_retour, " +
  "duree_nuits, duree_jours, prix_par_personne, devise, occupation, taxes_incluses, " +
  "compagnie_aerienne, aeroport_depart, etablissement_nom, etablissement_type, " +
  "etablissement_categorie, type_cabine, lien_reservation, contenus";

async function lireOffre(slug: string): Promise<OffrePublique | null> {
  const supabase = creerClientPublic();
  const { data } = await supabase
    .from("offres_publiques")
    .select(CHAMPS)
    .eq("slug", slug)
    .maybeSingle<OffrePublique>();
  return data ?? null;
}

async function lirePhotos(offreId: string) {
  const supabase = creerClientPublic();
  const { data } = await supabase
    .from("photos")
    .select("id, url, role, ordre")
    .eq("offre_id", offreId)
    .order("ordre");
  const photos = (data ?? []) as { id: string; url: string; role: string }[];
  return {
    hero: photos.find((p) => p.role === "hero") ?? photos[0] ?? null,
    galerie: photos.filter((p) => p.role !== "hero"),
  };
}

export async function generateStaticParams() {
  const supabase = creerClientPublic();
  const { data } = await supabase.from("offres_publiques").select("slug");
  return (data ?? []).map((o: { slug: string }) => ({ slug: o.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const offre = await lireOffre(slug);
  if (!offre) return { title: "Offre introuvable — Aéroport Voyage" };

  const fr = offre.contenus?.fr ?? {};
  const titre = fr.titre || offre.destination_pays || "Voyage";
  const description =
    fr.accroche ||
    `${titre}${offre.prix_par_personne ? ` à partir de ${offre.prix_par_personne} $ par personne` : ""}.`;
  const { hero } = await lirePhotos(offre.id);

  return {
    title: `${titre} — ${AGENCE}`,
    description,
    openGraph: {
      title: titre,
      description,
      type: "website",
      locale: "fr_CA",
      images: hero ? [{ url: urlPhoto(hero.url), width: 1200, height: 630 }] : undefined,
    },
  };
}

const dateLongue = (iso: string) =>
  new Date(iso + "T12:00:00").toLocaleDateString("fr-CA", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

function Detail({
  icone,
  libelle,
  valeur,
}: {
  icone: React.ReactNode;
  libelle: string;
  valeur: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 text-muted-foreground">{icone}</div>
      <div className="flex flex-col">
        <span className="text-xs text-muted-foreground">{libelle}</span>
        <span className="text-sm font-medium">{valeur}</span>
      </div>
    </div>
  );
}

export default async function PageVoyage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const offre = await lireOffre(slug);
  if (!offre) notFound();

  const fr = offre.contenus?.fr ?? {};
  const titre = fr.titre || offre.destination_pays || "Votre prochain voyage";
  const { hero, galerie } = await lirePhotos(offre.id);

  const inclusions = fr.inclusions ?? [];
  const exclusions = fr.exclusions ?? [];
  const itineraire = (fr.itineraire ?? []).filter((e) => e.titre);
  const faq = (fr.faq ?? []).filter((e) => e.q && e.r);

  // Mentions du prix : celles composées pour le post, sinon reconstruites depuis
  // les faits. Elles disent l'essentiel — occupation et taxes.
  const mentionsComposees = fr.visuel?.colonnes?.[0]?.prix?.mentions ?? [];
  const mentions = mentionsComposees.length
    ? mentionsComposees
    : [
        "par personne",
        offre.occupation ? `occ. ${offre.occupation}` : "",
        offre.taxes_incluses ? "taxes incluses" : "",
      ].filter(Boolean);

  const duree =
    offre.duree_jours && offre.duree_nuits
      ? `${offre.duree_jours} jours / ${offre.duree_nuits} nuits`
      : offre.duree_jours
        ? `${offre.duree_jours} jours`
        : offre.duree_nuits
          ? `${offre.duree_nuits} nuits`
          : null;

  const dates =
    offre.date_depart && offre.date_retour
      ? `Du ${dateLongue(offre.date_depart)} au ${dateLongue(offre.date_retour)}`
      : offre.date_depart
        ? `Départ le ${dateLongue(offre.date_depart)}`
        : "Départs multiples — à confirmer";

  const lieu =
    [offre.destination_ville, offre.destination_pays].filter(Boolean).join(", ") || null;

  const details = [
    duree && { icone: <CalendarDays className="size-4" />, libelle: "Durée", valeur: duree },
    offre.aeroport_depart && {
      icone: <Plane className="size-4" />,
      libelle: "Départ de",
      valeur: offre.aeroport_depart,
    },
    offre.compagnie_aerienne && {
      icone: <Plane className="size-4" />,
      libelle: "Transporteur",
      valeur: offre.compagnie_aerienne,
    },
    offre.etablissement_nom && {
      icone: <Ship className="size-4" />,
      libelle: offre.etablissement_type === "navire" ? "Navire" : "Établissement",
      valeur: offre.etablissement_nom,
    },
    offre.etablissement_categorie && {
      icone: <Check className="size-4" />,
      libelle: "Catégorie",
      valeur: offre.etablissement_categorie,
    },
    offre.type_cabine && {
      icone: <Ticket className="size-4" />,
      libelle: "Cabine / chambre",
      valeur: offre.type_cabine,
    },
    lieu && { icone: <MapPin className="size-4" />, libelle: "Destination", valeur: lieu },
  ].filter(Boolean) as { icone: React.ReactNode; libelle: string; valeur: string }[];

  return (
    <article className="pb-24">
      {/* En-tête : photo pleine largeur */}
      <header className="relative">
        <div className="relative h-[46vh] min-h-[300px] w-full sm:h-[58vh]">
          {hero ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={urlPhoto(hero.url)}
              alt={titre}
              className="absolute inset-0 size-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-muted" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/10" />
          <div className="absolute inset-x-0 bottom-0">
            <div className="mx-auto flex max-w-3xl flex-col gap-3 px-4 pb-6">
              <div className="flex flex-wrap gap-2">
                {offre.type_produit && (
                  <Badge className="border-transparent bg-white/90 text-black capitalize">
                    {offre.type_produit}
                  </Badge>
                )}
                {duree && (
                  <Badge variant="outline" className="border-white/40 text-white">
                    {duree}
                  </Badge>
                )}
              </div>
              <h1 className="text-3xl leading-tight font-semibold text-white sm:text-4xl">
                {titre}
              </h1>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-3xl flex-col gap-10 px-4 py-8">
        {/* Prix et appel à l'action */}
        <Card className="border-2" style={{ borderColor: MARQUE }}>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col">
              <span className="text-sm text-muted-foreground">À partir de</span>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold tracking-tight">
                  {offre.prix_par_personne} $
                </span>
                <span className="text-sm text-muted-foreground">
                  {offre.devise ?? "CAD"}
                </span>
              </div>
              <span className="text-sm text-muted-foreground">{mentions.join(" · ")}</span>
            </div>
            <Button asChild size="lg" className="text-white" style={{ background: MARQUE }}>
              <a href="#reserver">JE RÉSERVE MAINTENANT</a>
            </Button>
          </CardContent>
        </Card>

        {fr.accroche && (
          <p className="text-lg leading-relaxed text-muted-foreground">{fr.accroche}</p>
        )}

        {/* Dates et détails */}
        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold tracking-tight">Le voyage</h2>
          <p className="text-sm font-medium">{dates}</p>
          {details.length > 0 && (
            <div className="grid grid-cols-1 gap-4 rounded-lg border bg-muted/30 p-4 sm:grid-cols-2">
              {details.map((d) => (
                <Detail key={d.libelle} {...d} />
              ))}
            </div>
          )}
        </section>

        {/* Inclusions et exclusions */}
        {(inclusions.length > 0 || exclusions.length > 0) && (
          <section className="grid gap-6 sm:grid-cols-2">
            {inclusions.length > 0 && (
              <div className="flex flex-col gap-3">
                <h2 className="text-xl font-semibold tracking-tight">Ce qui est inclus</h2>
                <ul className="flex flex-col gap-2">
                  {inclusions.map((i, k) => (
                    <li key={k} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 size-4 shrink-0" style={{ color: MARQUE }} />
                      <span>{i}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {exclusions.length > 0 && (
              <div className="flex flex-col gap-3">
                <h2 className="text-xl font-semibold tracking-tight">Non inclus</h2>
                <ul className="flex flex-col gap-2">
                  {exclusions.map((e, k) => (
                    <li
                      key={k}
                      className="flex items-start gap-2 text-sm text-muted-foreground"
                    >
                      <Minus className="mt-0.5 size-4 shrink-0" />
                      <span>{e}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        {/* Itinéraire */}
        {itineraire.length > 0 && (
          <section className="flex flex-col gap-4">
            <h2 className="text-xl font-semibold tracking-tight">Itinéraire</h2>
            <ol className="flex flex-col">
              {itineraire.map((etape, k) => (
                <li key={k} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <span
                      className="flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                      style={{ background: MARQUE }}
                    >
                      {etape.jour ?? k + 1}
                    </span>
                    {k < itineraire.length - 1 && <span className="w-px flex-1 bg-border" />}
                  </div>
                  <div className="flex flex-col gap-1 pb-5">
                    <span className="font-medium">{etape.titre}</span>
                    {etape.texte && (
                      <span className="text-sm text-muted-foreground">{etape.texte}</span>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* Galerie */}
        {galerie.length > 0 && (
          <section className="flex flex-col gap-4">
            <h2 className="text-xl font-semibold tracking-tight">En images</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {galerie.map((p) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={p.id}
                  src={urlPhoto(p.url)}
                  alt=""
                  className="aspect-[4/3] w-full rounded-lg border object-cover"
                />
              ))}
            </div>
          </section>
        )}

        {/* FAQ */}
        {faq.length > 0 && (
          <section className="flex flex-col gap-4">
            <h2 className="text-xl font-semibold tracking-tight">Questions fréquentes</h2>
            <Accordion type="single" collapsible className="w-full">
              {faq.map((e, k) => (
                <AccordionItem key={k} value={`q${k}`}>
                  <AccordionTrigger className="text-left">{e.q}</AccordionTrigger>
                  <AccordionContent>{e.r}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </section>
        )}

        <Separator />

        {/* Appel à l'action final */}
        <section id="reserver" className="flex flex-col gap-4 scroll-mt-20">
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-semibold tracking-tight">Cette offre vous intéresse ?</h2>
            <p className="text-sm text-muted-foreground">
              Un conseiller d&apos;Aéroport Voyage s&apos;occupe de la réservation avec vous.
              Aucune réservation ne se fait en ligne.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Button asChild size="lg" className="text-white" style={{ background: MARQUE }}>
              <a href={`tel:${TELEPHONE}`}>
                <Phone className="size-4" />
                Appeler le {TELEPHONE}
              </a>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a
                href={`mailto:${COURRIEL}?subject=${encodeURIComponent(`Offre : ${titre}`)}`}
              >
                <Mail className="size-4" />
                Écrire à un conseiller
              </a>
            </Button>
            {offre.lien_reservation && (
              <Button asChild size="lg" variant="outline" className="sm:col-span-2">
                <a href={offre.lien_reservation} target="_blank" rel="noreferrer">
                  <Ticket className="size-4" />
                  Voir la disponibilité chez le fournisseur
                </a>
              </Button>
            )}
          </div>
        </section>
      </div>

      {/* Barre collante : le bouton principal reste à portée de pouce */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 p-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="hidden flex-col sm:flex">
            <span className="text-xs text-muted-foreground">À partir de</span>
            <span className="text-lg font-bold">{offre.prix_par_personne} $ / pers.</span>
          </div>
          <Button
            asChild
            size="lg"
            className="flex-1 text-white"
            style={{ background: MARQUE }}
          >
            <a href="#reserver">JE RÉSERVE MAINTENANT</a>
          </Button>
        </div>
      </div>
    </article>
  );
}
