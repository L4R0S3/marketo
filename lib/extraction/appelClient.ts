// Appel des deux étapes IA depuis le navigateur.
//
// La route ne répond pas toujours du JSON : quand la fonction serverless est
// coupée, c'est la plateforme qui répond, en texte brut. Un `res.json()` nu
// lève alors « Unexpected token 'A', "An error o"... is not valid JSON » et
// l'opérateur voit ce charabia à la place d'un message utile. On lit donc le
// corps en texte, puis on tente le JSON.

export type EtapeIA = "extraction" | "composition";

const LIBELLE: Record<EtapeIA, string> = {
  extraction: "L'extraction",
  composition: "La composition",
};

// null = succès ; sinon le message à afficher tel quel à l'opérateur.
export async function lancerEtapeIA(
  offreId: string,
  etape: EtapeIA,
): Promise<string | null> {
  let res: Response;
  let brut: string;
  try {
    res = await fetch("/api/extraction", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ offreId, etape }),
    });
    brut = await res.text();
  } catch (e) {
    return e instanceof Error ? e.message : "Échec réseau.";
  }

  let json: { error?: string } | null = null;
  try {
    json = JSON.parse(brut) as { error?: string };
  } catch {
    /* réponse non-JSON : traitée juste en dessous */
  }

  if (res.ok) return json ? null : `Réponse inattendue du serveur : ${brut.slice(0, 200)}`;

  if (json?.error) return json.error;

  // 504 : la fonction a dépassé son temps d'exécution. C'est le cas le plus
  // probable d'une réponse non-JSON, et le message par défaut ne dit rien.
  if (res.status === 504)
    return `${LIBELLE[etape]} a dépassé le temps alloué au serveur. Relance : le modèle est parfois plus lent.`;

  return `${LIBELLE[etape]} a échoué (HTTP ${res.status}). ${brut.slice(0, 200)}`;
}
