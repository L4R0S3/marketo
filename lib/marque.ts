// Constantes de marque, partagées par les pages publiques.
// Le bleu est relevé à la pipette sur le bloc signature des frames — c'est le
// bleu du logo, pas une des six teintes de post (celles-là habillent le visuel,
// pas l'interface).

export const MARQUE = "#516BF3";

// Base des liens absolus des courriels : un client de messagerie n'a pas de
// notion de chemin relatif. Vercel expose VERCEL_PROJECT_PRODUCTION_URL ; en
// local on retombe sur le serveur de développement.
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");
export const TELEPHONE = "514-289-8686";
export const COURRIEL = "info@aeroportvoyage.com";
export const AGENCE = "Aéroport Voyage";
