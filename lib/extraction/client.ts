import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { FaitsBase, FaitsExtraction, type Faits } from "@/lib/schema/offre";
import { PROMPT_SYSTEME_EXTRACTION } from "./prompt";

const anthropic = new Anthropic(); // lit ANTHROPIC_API_KEY dans l'environnement

export type SourceExtraction =
  | { kind: "image"; mediaType: "image/png" | "image/jpeg" | "image/webp"; base64: string }
  | { kind: "pdf"; base64: string }
  | { kind: "html"; texte: string };

// APPEL 1 — extraction des faits. AUCUNE relance (règle section 8) : en cas
// d'échec de forme ou de cohérence, on lève et l'opérateur voit l'erreur.
export async function extraireFaits(source: SourceExtraction): Promise<Faits> {
  const contenu: Anthropic.ContentBlockParam[] = [];

  if (source.kind === "image") {
    contenu.push({
      type: "image",
      source: { type: "base64", media_type: source.mediaType, data: source.base64 },
    });
  } else if (source.kind === "pdf") {
    contenu.push({
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: source.base64 },
    });
  } else {
    contenu.push({
      type: "text",
      text: "Contenu HTML de la page source :\n\n" + source.texte,
    });
  }
  contenu.push({ type: "text", text: "Extrais les faits de ce document." });

  // claude-sonnet-5 : pas de temperature/top_p/top_k, pas de paramètre thinking
  // (le thinking adaptatif est actif par défaut). max_tokens couvre thinking + JSON.
  const reponse = await anthropic.messages.parse({
    model: "claude-sonnet-5",
    max_tokens: 16000,
    system: PROMPT_SYSTEME_EXTRACTION,
    messages: [{ role: "user", content: contenu }],
    output_config: { format: zodOutputFormat(FaitsBase) },
  });

  const brut = reponse.parsed_output;
  if (!brut) {
    throw new Error("L'extraction n'a pas renvoyé de JSON exploitable.");
  }

  // Cohérence métier côté client (dates, prix). Aucune relance automatique.
  const valide = FaitsExtraction.safeParse(brut);
  if (!valide.success) {
    const details = valide.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join(" ; ");
    throw new Error("Incohérence dans les faits extraits — " + details);
  }
  return valide.data;
}
