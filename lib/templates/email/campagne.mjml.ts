import { AGENCE, COURRIEL, TELEPHONE } from "@/lib/marque";
import { COULEURS, LARGEUR, POLICES, html } from "./theme";
import { bloc, type VarianteBloc } from "./bloc.mjml";
import type { BlocOffre } from "./donnees";

// Document courriel complet : en-tête de marque, un bloc par offre, pied de page.
// Chaque bloc est une carte blanche indépendante, comme dans les références.

export type OffreCampagne = { offre: BlocOffre; variante: VarianteBloc };

const enveloppe = (contenu: string) => `
  <mj-wrapper background-color="${COULEURS.carte}" padding="0" border-radius="0">
    ${contenu}
  </mj-wrapper>`;

export function campagneMjml(offres: OffreCampagne[], titreEnvoi?: string): string {
  return `<mjml>
  <mj-head>
    <mj-title>${html(titreEnvoi ?? `${AGENCE} — nos offres`)}</mj-title>
    <mj-preview>${html(offres[0]?.offre.titre ?? "Nos offres de la semaine")}</mj-preview>
    <mj-attributes>
      <mj-all font-family="${POLICES.corps}" />
      <mj-text color="${COULEURS.texte}" font-size="14px" line-height="1.6" />
      <mj-section background-color="${COULEURS.carte}" />
    </mj-attributes>
    <mj-style>
      .ombre div { text-shadow: 1px 1px 4px rgba(0,0,0,.85); }
    </mj-style>
  </mj-head>

  <mj-body background-color="${COULEURS.fond}" width="${LARGEUR}px">

    <mj-section background-color="${COULEURS.fond}" padding="30px 10px 20px 10px">
      <mj-column>
        <mj-text align="center" font-size="20px" font-weight="bold" letter-spacing="3px" color="${COULEURS.encre}" text-transform="uppercase" padding="0">
          ${html(AGENCE)}
        </mj-text>
        <mj-text align="center" font-size="11px" letter-spacing="2px" color="${COULEURS.orSombre}" text-transform="uppercase" padding="6px 0 0 0">
          ${html(titreEnvoi ?? "Nos offres de la semaine")}
        </mj-text>
      </mj-column>
    </mj-section>

    ${offres.map((o) => enveloppe(bloc(o.offre, o.variante))).join(`
    <mj-section background-color="${COULEURS.fond}" padding="12px 0"><mj-column><mj-text padding="0" font-size="1px">&nbsp;</mj-text></mj-column></mj-section>
    `)}

    <mj-section background-color="${COULEURS.fond}" padding="30px 20px 40px 20px">
      <mj-column>
        <mj-text align="center" font-size="12px" color="${COULEURS.gris}" line-height="1.8" padding="0">
          <strong>${html(AGENCE)}</strong><br/>
          <a href="tel:${TELEPHONE}" style="color:${COULEURS.gris};text-decoration:none;">${TELEPHONE}</a>
          &nbsp;·&nbsp;
          <a href="mailto:${COURRIEL}" style="color:${COULEURS.gris};text-decoration:none;">${COURRIEL}</a>
        </mj-text>
        <mj-text align="center" font-size="11px" color="${COULEURS.grisClair}" line-height="1.6" padding="14px 0 0 0">
          Les prix sont par personne, en dollars canadiens, et peuvent changer sans préavis.
          Aucune réservation ne se fait par courriel.
        </mj-text>
        <mj-text align="center" font-size="11px" color="${COULEURS.grisClair}" padding="10px 0 0 0">
          <!-- Mailchimp remplace *|UNSUB|* par le lien de désinscription de la liste. -->
          <a href="*|UNSUB|*" style="color:${COULEURS.grisClair};text-decoration:underline;">Se désinscrire</a>
        </mj-text>
      </mj-column>
    </mj-section>

  </mj-body>
</mjml>`;
}

// Un seul bloc, pour l'aperçu de l'étape Sorties : même gabarit, même rendu que
// dans la campagne, sans en-tête ni pied de page.
export function blocSeulMjml(offre: BlocOffre, variante: VarianteBloc): string {
  return `<mjml>
  <mj-head>
    <mj-attributes>
      <mj-all font-family="${POLICES.corps}" />
      <mj-text color="${COULEURS.texte}" font-size="14px" line-height="1.6" />
      <mj-section background-color="${COULEURS.carte}" />
    </mj-attributes>
    <mj-style>
      .ombre div { text-shadow: 1px 1px 4px rgba(0,0,0,.85); }
    </mj-style>
  </mj-head>
  <mj-body background-color="${COULEURS.fond}" width="${LARGEUR}px">
    ${enveloppe(bloc(offre, variante))}
  </mj-body>
</mjml>`;
}
