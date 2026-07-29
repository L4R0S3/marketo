import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { SortieExtraction, FaitsExtraction, type Faits } from "@/lib/schema/offre";
import { PROMPT_SYSTEME_EXTRACTION } from "./prompt";

const anthropic = new Anthropic(); // lit ANTHROPIC_API_KEY dans l'environnement

export type SourceExtraction =
  | { kind: "image"; mediaType: "image/png" | "image/jpeg" | "image/webp"; base64: string }
  | { kind: "pdf"; base64: string }
  | { kind: "html"; texte: string };

// Résultat de l'Appel 1. Soit des faits cohérents, soit un message d'erreur
// destiné à l'opérateur (document illisible OU incohérence métier). Jamais de
// relance automatique (règle section 8).
export type ResultatExtraction =
  | { ok: true; faits: Faits }
  | { ok: false; erreur: string };

export async function extraireFaits(source: SourceExtraction): Promise<ResultatExtraction> {
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
    output_config: { format: zodOutputFormat(SortieExtraction) },
  });

  const sortie = reponse.parsed_output;
  if (!sortie) {
    return { ok: false, erreur: "L'extraction n'a pas renvoyé de JSON exploitable." };
  }

  // Le modèle a jugé le document inexploitable : on remonte son message tel quel.
  if (sortie.statut === "erreur" || !sortie.faits) {
    return { ok: false, erreur: sortie.erreur ?? "Document inexploitable (aucune offre identifiable)." };
  }

  // Cohérence métier côté client (dates, prix). Aucune relance automatique.
  const valide = FaitsExtraction.safeParse(sortie.faits);
  if (!valide.success) {
    const details = valide.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join(" ; ");
    return { ok: false, erreur: "Incohérence dans les faits extraits — " + details };
  }
  return { ok: true, faits: valide.data };
}
