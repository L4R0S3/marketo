// mjml 5 ne fournit pas de typage. Déclaration minimale de ce qu'on utilise.
// À noter : la compilation est ASYNCHRONE depuis la version 5.
declare module "mjml" {
  type Options = {
    validationLevel?: "strict" | "soft" | "skip";
    keepComments?: boolean;
    minify?: boolean;
    beautify?: boolean;
  };
  type Erreur = { line?: number; message?: string; formattedMessage?: string };
  export default function mjml2html(
    mjml: string,
    options?: Options,
  ): Promise<{ html: string; errors: Erreur[] }>;
}
