import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { CompositionForme, CompositionSociale, type CompositionT } from "./schema";
import { PROMPT_SYSTEME_COMPOSITION } from "./prompt";

// Instanciation PARESSEUSE : à l'import, l'environnement n'est pas forcément
// chargé (les imports ES sont évalués avant le corps du module appelant, donc
// avant process.loadEnvFile des scripts de test).
let client: Anthropic | null = null;
function anthropic(): Anthropic {
  client ??= new Anthropic(); // lit ANTHROPIC_API_KEY dans l'environnement
  return client;
}

// Les faits validés de l'Appel 1, tels qu'ils partent au modèle. Record permissif
// à dessein : ils viennent de nettoyerSentinelles() en phase 2, puis des colonnes
// corrigées par l'opérateur en phase 3. Aucun fait n'est réinterprété ici.
export type FaitsPourComposition = Record<string, unknown>;

export type ResultatComposition =
  | { ok: true; composition: CompositionT; relance: boolean }
  | { ok: false; erreur: string };

// Le schéma envoyé à l'API (CompositionForme) ne porte PAS les longueurs : les
// structured outputs ne connaissent ni minLength ni maxLength. C'est
// CompositionSociale qui les vérifie ici, et son message d'erreur qui repart au
// modèle pour l'UNIQUE relance autorisée (CLAUDE.md §8).
const RELANCES_MAX = 1;

export async function composerTexte(
  faits: FaitsPourComposition,
): Promise<ResultatComposition> {
  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content:
        "Faits validés de cette offre (JSON). Compose le texte à partir de ces seules données :\n\n" +
        JSON.stringify(faits, null, 2),
    },
  ];

  for (let essai = 0; essai <= RELANCES_MAX; essai++) {
    // claude-sonnet-5 : pas de temperature/top_p/top_k, pas de paramètre thinking.
    const reponse = await anthropic().messages.parse({
      model: "claude-sonnet-5",
      max_tokens: 16000,
      system: PROMPT_SYSTEME_COMPOSITION,
      messages,
      output_config: { format: zodOutputFormat(CompositionForme) },
    });

    const brut = reponse.parsed_output;
    if (!brut) {
      return { ok: false, erreur: "La composition n'a pas renvoyé de JSON exploitable." };
    }

    const valide = CompositionSociale.safeParse(brut);
    if (valide.success) {
      return { ok: true, composition: valide.data, relance: essai > 0 };
    }

    const details = valide.error.issues
      .map((i) => `${i.path.join(".") || "(racine)"} : ${i.message}`)
      .join("\n");

    if (essai === RELANCES_MAX) {
      return {
        ok: false,
        erreur: "Le texte composé dépasse encore les limites du gabarit après relance —\n" + details,
      };
    }

    // Relance : on renvoie la sortie fautive et l'erreur, avec une consigne qui
    // n'autorise QUE le raccourcissement.
    messages.push(
      { role: "assistant", content: JSON.stringify(brut) },
      {
        role: "user",
        content:
          "Ta sortie ne respecte pas les limites du gabarit :\n" +
          details +
          "\n\nRenvoie la MÊME composition, raccourcie aux endroits signalés. " +
          "Ne change aucun chiffre, aucune date, aucun fait, et ne touche pas aux champs corrects.",
      },
    );
  }

  return { ok: false, erreur: "Composition échouée." };
}
