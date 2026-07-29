/**
 * Test RLS de bout en bout — emprunte le chemin réel de l'app (client Supabase
 * + PostgREST), pas la couche SQL brute. Réexécutable à chaque changement de RLS.
 *
 *   npm run test:rls   (ou : npx tsx scripts/test-rls.ts)
 *
 * Prérequis dans .env.local :
 *   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// ── Chargement de .env.local (Node ≥ 20.12) ─────────────────────────────
try {
  process.loadEnvFile(".env.local");
} catch {
  console.error("✖ .env.local introuvable ou illisible à la racine du projet.");
  process.exit(1);
}

// ── Garde-fous de sécurité ──────────────────────────────────────────────
function fatal(msg: string): never {
  console.error(`✖ ${msg}`);
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url) fatal("NEXT_PUBLIC_SUPABASE_URL manquant dans .env.local.");
if (!anonKey) fatal("NEXT_PUBLIC_SUPABASE_ANON_KEY manquant dans .env.local.");
if (!serviceKey)
  fatal(
    "SUPABASE_SERVICE_ROLE_KEY manquant dans .env.local " +
      "(Dashboard → Project Settings → API → clé « service_role secret »).",
  );

// La clé service_role contourne tout le RLS : jamais exposée au navigateur.
if (process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY)
  fatal(
    "La clé service_role est préfixée NEXT_PUBLIC_ : elle partirait dans le " +
      "bundle navigateur. Renomme-la SUPABASE_SERVICE_ROLE_KEY (sans préfixe).",
  );

// .env.local doit être ignoré par Git.
try {
  const gitignore = readFileSync(".gitignore", "utf8");
  const ignore =
    /^\s*\.env\*?\s*$/m.test(gitignore) || /^\s*\.env\.local\s*$/m.test(gitignore);
  const unignore = /^\s*!\s*\.env\.local\s*$/m.test(gitignore);
  if (!ignore || unignore)
    fatal(".env.local n'est pas couvert par .gitignore — la clé service_role risque d'être commitée.");
} catch {
  fatal(".gitignore introuvable — impossible de vérifier que .env.local est ignoré.");
}

// ── Clients ─────────────────────────────────────────────────────────────
const auth = { persistSession: false, autoRefreshToken: false } as const;
const service = createClient(url, serviceKey, { auth });
const anon = createClient(url, anonKey, { auth });

// ── Rapport ─────────────────────────────────────────────────────────────
let echecs = 0;
function report(nom: string, pass: boolean, detail: string) {
  const etat = pass ? "PASS" : "FAIL";
  if (!pass) echecs++;
  console.log(`${etat}  ${nom}${pass ? "" : `\n        → ${detail}`}`);
}

const PREFIXE = "zz-test-";

async function nettoyer() {
  await service.from("offres").delete().like("slug", `${PREFIXE}%`);
  await service.storage.from("documents").remove(["zz-test.txt"]);
  await service.storage.from("photos").remove(["zz-test.txt"]);
}

async function main() {
  try {
    // Nettoyage préalable (résidus d'un run précédent) puis mise en place.
    await nettoyer();

    const { error: insErr } = await service.from("offres").insert([
      { slug: `${PREFIXE}brouillon`, statut: "brouillon", destination_pays: "ZZ" },
      { slug: `${PREFIXE}publiee`, statut: "publiee", destination_pays: "ZZ" },
    ]);
    if (insErr) fatal(`Mise en place échouée (insert service_role) : ${insErr.message}`);

    const contenu = Buffer.from("zz-test");
    await service.storage
      .from("documents")
      .upload("zz-test.txt", contenu, { contentType: "text/plain", upsert: true });
    await service.storage
      .from("photos")
      .upload("zz-test.txt", contenu, { contentType: "text/plain", upsert: true });

    // ── TEST 1 — Filtrage de la vue ───────────────────────────────────
    {
      const { data, error } = await anon
        .from("offres_publiques")
        .select("slug")
        .like("slug", `${PREFIXE}%`);
      const slugs = (data ?? []).map((r) => r.slug as string).sort();
      const pass =
        !error && slugs.length === 1 && slugs[0] === `${PREFIXE}publiee`;
      report(
        "TEST 1 — Filtrage de la vue (offres_publiques)",
        pass,
        error ? `erreur inattendue : ${error.message}` : `vu par anon : [${slugs.join(", ")}] (attendu : [${PREFIXE}publiee])`,
      );
    }

    // ── TEST 2 — Colonnes internes fermées ────────────────────────────
    {
      const { data, error } = await anon
        .from("offres")
        .select("extraction_brute")
        .limit(1);
      const pass = !!error; // retour vide sans erreur = ÉCHEC (revoke non pris)
      report(
        "TEST 2 — Colonne interne fermée (extraction_brute)",
        pass,
        error
          ? `refus : ${error.message}`
          : `AUCUNE erreur — le revoke colonne n'a pas pris. data=${JSON.stringify(data)}`,
      );
    }

    // ── TEST 3 — Accessibilité de la vue ──────────────────────────────
    {
      const { count, error } = await anon
        .from("offres_publiques")
        .select("*", { count: "exact", head: true });
      const pass = !error && typeof count === "number";
      report(
        "TEST 3 — Vue accessible à anon",
        pass,
        error ? `erreur : ${error.message}` : `count=${count}`,
      );
    }

    // ── TEST 4 — Écriture interdite ───────────────────────────────────
    {
      const { error } = await anon
        .from("offres")
        .insert({ slug: `${PREFIXE}insert-anon`, statut: "brouillon" });
      const pass = !!error;
      report(
        "TEST 4 — Écriture refusée à anon",
        pass,
        error ? `refus : ${error.message}` : "INSERT accepté par anon — FAILLE.",
      );
    }

    // ── TEST 5 — Bucket documents privé / photos lisible ──────────────
    {
      const doc = await anon.storage
        .from("documents")
        .list("", { search: "zz-test.txt" });
      const docVisible =
        !doc.error && (doc.data ?? []).some((o) => o.name === "zz-test.txt");

      const pho = await anon.storage
        .from("photos")
        .list("", { search: "zz-test.txt" });
      const phoVisible =
        !pho.error && (pho.data ?? []).some((o) => o.name === "zz-test.txt");

      const pass = !docVisible && phoVisible;
      report(
        "TEST 5 — documents privé / photos public",
        pass,
        `documents visible par anon=${docVisible} (attendu false)` +
          (doc.error ? ` [refus: ${doc.error.message}]` : "") +
          ` ; photos visible par anon=${phoVisible} (attendu true)` +
          (pho.error ? ` [erreur: ${pho.error.message}]` : ""),
      );
    }
  } finally {
    await nettoyer();
  }
}

main()
  .then(() => {
    console.log(
      echecs === 0
        ? "\n✔ Les 5 tests sont au vert."
        : `\n✖ ${echecs} test(s) en échec.`,
    );
    process.exit(echecs === 0 ? 0 : 1);
  })
  .catch((e) => {
    console.error("Erreur inattendue :", e);
    // Best effort : tenter un nettoyage même sur crash.
    nettoyer().finally(() => process.exit(1));
  });
