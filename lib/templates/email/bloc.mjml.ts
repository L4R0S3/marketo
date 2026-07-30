import { SITE_URL } from "@/lib/marque";
import { COULEURS, LARGEUR, POLICES, html, montant } from "./theme";
import type { BlocOffre } from "./donnees";

// Les deux variantes de bloc, en MJML. Reconstruites d'après les références de
// fixtures/email/ — leur HTML n'est PAS réutilisé : il vient de Canva, avec des
// div en positionnement absolu qu'Outlook et Gmail cassent. MJML compile vers
// des tableaux à CSS inline, ce qui est le seul rendu fiable en courriel.
//
// Aucun emoji : Outlook desktop les casse. Les libellés sont en gras à la place.

const CTA = "JE VEUX PLUS D'INFOS";

const lien = (slug: string) => `${SITE_URL}/voyage/${slug}`;

const etoiles = (n: number | null) => (n ? "★".repeat(n) : "");

// Prix : le tarif régulier barré n'apparaît que si l'offre en porte un.
function blocPrix(o: BlocOffre, taille: number) {
  const barre = o.prixAvantRabais
    ? `<div style="text-decoration:line-through;color:${COULEURS.grisClair};font-size:13px;margin-bottom:2px;">${montant(o.prixAvantRabais)}</div>`
    : "";
  return `${barre}
        <div style="font-size:${taille}px;color:${COULEURS.encre};font-weight:900;line-height:1.1;margin-bottom:4px;">${montant(o.prix)}</div>
        <div style="font-size:10px;color:${COULEURS.gris};line-height:1.4;">${o.mentions.map(html).join("<br/>")}</div>`;
}

function listeDetails(o: BlocOffre, taille: number) {
  return o.details
    .map(
      (d) =>
        `<strong>${html(d.libelle)} :</strong> ${html(d.valeur)}`,
    )
    .join("<br/>")
    .replace(/^/, `<div style="font-size:${taille}px;color:${COULEURS.texte};line-height:1.9;">`)
    .concat("</div>");
}

const galerie = (o: BlocOffre, hauteur: number) =>
  o.galerie.length === 2
    ? `<mj-section padding="0">
    ${o.galerie
      .map(
        (u) =>
          `<mj-column width="50%" padding="0"><mj-image src="${u}" alt="" width="${LARGEUR / 2}px" height="${hauteur}px" padding="0" fluid-on-mobile="true" /></mj-column>`,
      )
      .join("\n    ")}
  </mj-section>`
    : "";

const filetOr = (epaisseur: number) =>
  `<mj-section padding="0" background-color="${COULEURS.or}">
    <mj-column padding="0"><mj-text padding="0" font-size="1px" line-height="${epaisseur}px">&nbsp;</mj-text></mj-column>
  </mj-section>`;

// ── Variante « vedette » (référence Luxe Lumineux 1) ───────────────────────
export function blocVedette(o: BlocOffre): string {
  // La destination est déjà le sous-titre : le nom ne la répète pas.
  const sousTitre = o.destination ?? o.categorie ?? "";
  const nom = o.etablissement ?? o.titre;

  return `
  ${
    o.hero
      ? `<mj-section padding="0"><mj-column padding="0"><mj-image src="${o.hero}" alt="${html(o.titre)}" width="${LARGEUR}px" padding="0" /></mj-column></mj-section>`
      : ""
  }

  <mj-section background-color="${COULEURS.creme}" padding="35px 20px" border-bottom="1px solid ${COULEURS.filet}">
    <mj-column>
      ${
        o.etoiles
          ? `<mj-text align="center" color="${COULEURS.or}" font-size="22px" letter-spacing="3px" padding="0 0 8px 0">${etoiles(o.etoiles)}</mj-text>`
          : ""
      }
      ${
        sousTitre
          ? `<mj-text align="center" color="${COULEURS.orSombre}" font-size="11px" font-weight="bold" text-transform="uppercase" letter-spacing="1px" padding="0 0 15px 0">${html(sousTitre)}</mj-text>`
          : ""
      }
      <mj-text align="center" font-family="${POLICES.titre}" font-size="28px" color="${COULEURS.encre}" line-height="1.3" padding="0 0 12px 0">${html(nom)}</mj-text>
      <mj-divider border-width="2px" border-color="${COULEURS.or}" width="40px" padding="0" />
    </mj-column>
  </mj-section>

  ${galerie(o, 220)}

  <mj-section padding="35px 30px">
    <mj-column width="52%" vertical-align="middle" padding-right="15px">
      <mj-text padding="0">${listeDetails(o, 14)}</mj-text>
    </mj-column>
    <mj-column width="48%" vertical-align="middle" padding-left="15px" border-left="1px solid ${COULEURS.filet}">
      <mj-text align="center" padding="0">${blocPrix(o, 34)}</mj-text>
    </mj-column>
  </mj-section>

  <mj-section padding="0 30px 40px 30px">
    <mj-column>
      <mj-button href="${lien(o.slug)}" background-color="${COULEURS.encre}" color="#ffffff" font-size="13px" font-weight="bold" letter-spacing="2px" text-transform="uppercase" border-radius="4px" inner-padding="14px 28px" width="100%">${CTA}</mj-button>
    </mj-column>
  </mj-section>

  ${filetOr(6)}`;
}

// ── Variante « condensé » (référence Luxe Lumineux 2) ──────────────────────
export function blocCondense(o: BlocOffre): string {
  const nom = o.etablissement ?? o.titre;

  return `
  <mj-section ${o.hero ? `background-url="${o.hero}" background-size="cover" background-repeat="no-repeat"` : ""} background-color="${COULEURS.orSombre}" padding="45px 15px" border-bottom="3px solid ${COULEURS.or}">
    <!-- Voile sombre derrière le texte, comme la référence. Les clients qui
         ignorent l'alpha (Outlook) retombent sur la couleur de la section. -->
    <mj-column background-color="rgba(0,0,0,0.35)" padding="14px 10px">
      ${
        o.etoiles
          ? `<mj-text align="center" color="${COULEURS.or}" font-size="18px" letter-spacing="4px" padding="0 0 4px 0" css-class="ombre">${etoiles(o.etoiles)}</mj-text>`
          : ""
      }
      <mj-text align="center" font-family="${POLICES.titre}" font-size="30px" color="#ffffff" line-height="1.2" padding="0" css-class="ombre">${html(nom)}</mj-text>
      ${
        o.destination
          ? `<mj-text align="center" color="#fdfbf7" font-size="12px" font-weight="bold" text-transform="uppercase" letter-spacing="2px" padding="6px 0 0 0" css-class="ombre">${html(o.destination)}</mj-text>`
          : ""
      }
    </mj-column>
  </mj-section>

  ${galerie(o, 160)}

  <mj-section padding="25px 20px">
    <mj-column width="55%" vertical-align="middle" padding-right="15px" border-right="1px solid ${COULEURS.filet}">
      <mj-text padding="0">${listeDetails(o, 13)}</mj-text>
    </mj-column>
    <mj-column width="45%" vertical-align="middle" padding-left="15px">
      <mj-text align="center" padding="0 0 12px 0">${blocPrix(o, 28)}</mj-text>
      <mj-button href="${lien(o.slug)}" background-color="${COULEURS.encre}" color="#ffffff" font-size="11px" font-weight="bold" letter-spacing="1px" text-transform="uppercase" border-radius="4px" inner-padding="10px 14px" padding="0" width="100%">${CTA}</mj-button>
    </mj-column>
  </mj-section>

  ${filetOr(4)}`;
}

export type VarianteBloc = "vedette" | "condense";

export function bloc(o: BlocOffre, variante: VarianteBloc): string {
  return variante === "vedette" ? blocVedette(o) : blocCondense(o);
}
