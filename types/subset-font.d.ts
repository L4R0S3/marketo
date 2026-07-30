// subset-font ne fournit pas de typage. Déclaration minimale des options qu'on
// utilise dans scripts/polices.ts.
declare module "subset-font" {
  type Options = {
    targetFormat?: "sfnt" | "truetype" | "woff" | "woff2";
    preserveNameIds?: number[];
    noLayoutClosure?: boolean;
    variationAxes?: Record<string, number | { min: number; max: number; default?: number }>;
  };
  export default function subsetFont(
    police: Buffer,
    caracteres: string,
    options?: Options,
  ): Promise<Buffer>;
}
