import mjml2html from "mjml";

// Compilation MJML → HTML courriel. Côté serveur uniquement : MJML est un outil
// de build, il n'a rien à faire dans le paquet envoyé au navigateur.
// next.config.ts le déclare en serverExternalPackages pour qu'il ne soit pas
// empaqueté par Turbopack.

export type ResultatCompilation = { html: string; avertissements: string[] };

// MJML 5 compile de façon ASYNCHRONE (la 4 était synchrone) : l'appel rend une
// promesse, et l'oublier donne un `html` undefined sans la moindre erreur.
export async function compiler(mjml: string): Promise<ResultatCompilation> {
  const { html, errors } = await mjml2html(mjml, {
    validationLevel: "soft", // on veut le HTML même si un attribut déplaît
    keepComments: false,
  });
  return {
    html,
    avertissements: (errors ?? []).map((e) => e.formattedMessage ?? String(e)),
  };
}
