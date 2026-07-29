# Machine Marketing — Aéroport Voyage

> Ce fichier est la source de vérité du projet. Sauvegarde-le à la racine du dépôt
> sous le nom `CLAUDE.md` pour que Claude Code le lise automatiquement à chaque session.

---

## 1. Mission

Aéroport Voyage est une agence de voyage québécoise (Montréal). Chaque semaine, un
conseiller reçoit des offres de fournisseurs sous des formes hétérogènes — captures
d'écran du système Sirev, PDF d'Exoticca ou GVQ, pages web de circuits Transat — et
doit les transformer manuellement en matériel marketing.

On construit un outil interne qui automatise cette transformation.

**Entrée** : un fichier déposé par glisser-déposer (PNG, JPG, PDF) ou une URL.

**Sorties**, pour chaque offre :

1. Une image de post social 1080 × 1350, prête à téléverser sur Facebook et Instagram
2. Un bloc HTML compatible courriel, à copier-coller dans Mailchimp
3. Une landing page publique non transactionnelle, une par voyage

L'application ne publie rien elle-même. Elle génère, l'humain copie-colle. Les
landing pages, elles, se déploient automatiquement.

**Volume cible** : 5 à 10 offres par semaine, un envoi courriel hebdomadaire.
**Utilisateurs** : 2 à 4 personnes de l'agence.

Ce faible volume est une décision d'architecture : **tout reste synchrone**. Pas de
file d'attente, pas de worker, pas de cron, pas de webhook. Une extraction prend
15 secondes, on affiche un indicateur de progression et c'est réglé. N'introduis
aucune infrastructure asynchrone sans me demander d'abord.

---

## 2. Pile technique imposée

| Rôle | Choix |
|---|---|
| Framework | Next.js 16, App Router, TypeScript strict |
| Styles | Tailwind CSS v4 (configuration CSS via `@theme`, pas de `tailwind.config.ts`) |
| Optimisation | React Compiler **désactivé** (admin laid, perf non critique) |
| Composants admin | shadcn/ui, thème par défaut |
| Base de données | Supabase Postgres |
| Fichiers | Supabase Storage |
| Authentification | Supabase Auth, courriel + mot de passe |
| Validation | Zod |
| Formulaires | react-hook-form + `@hookform/resolvers/zod` |
| Extraction | `@anthropic-ai/sdk`, modèle `claude-sonnet-5` |
| Rendu image | `ImageResponse` de `next/og` (Satori, inclus avec l'App Router — rien à installer) |
| Gabarit courriel | MJML compilé côté serveur |
| Hébergement | Vercel |

Un seul dépôt, un seul déploiement. L'application interne et les landing pages
publiques vivent dans le même projet Next.js, séparées par des route groups.

### Contraintes du modèle `claude-sonnet-5` (génération actuelle)

Le modèle d'extraction est `claude-sonnet-5`. Trois contraintes **impératives** dans
le code d'appel API, sous peine d'erreur 400 :

- **Aucun paramètre `temperature`, `top_p` ni `top_k`.** Toute valeur non par défaut
  retourne une 400. Piège classique : le réflexe `temperature: 0` sur une tâche
  d'extraction. On ne le passe pas.
- **Aucun paramètre `thinking`.** Le thinking adaptatif est actif par défaut et ne se
  désactive pas ; passer `thinking` manuellement retourne une 400.
- **Contexte 1M tokens par défaut, 128k tokens de sortie maximum.** Au-delà de ~16k de
  sortie, utiliser le streaming (`.stream()` + `.finalMessage()`) pour éviter les
  timeouts HTTP du SDK.

---

## 3. Périmètre

### Dans la v1

- Dépôt de fichier ou d'URL, stockage de l'original
- Extraction par IA vers un JSON structuré
- Écran de validation à deux volets avec aperçu en direct
- Génération des trois sorties
- Composition d'une campagne courriel regroupant plusieurs offres
- Landing pages publiques

### Hors périmètre — ne construis pas ça

- API Facebook, Instagram ou Mailchimp
- Interface anglaise (voir section 5 pour la préparation)
- Banque d'images réutilisable
- Analytique, suivi de conversion
- Rôles et permissions au-delà de « connecté ou non »
- Formulaire de réservation en ligne

Le panneau d'administration doit être **fonctionnel, pas joli**. Composants shadcn
par défaut, aucune personnalisation visuelle. Tout l'effort esthétique va dans les
sorties générées, pas dans l'outil. Ne perds pas de temps sur l'apparence de l'admin.

---

## 4. Le flux

```
1. DÉPÔT       Fichier ou URL → Supabase Storage → ligne `offres` au statut brouillon
2. EXTRACTION  Document → API Claude (vision) → JSON conforme au schéma Offre
3. VALIDATION  Deux volets : original à gauche, formulaire + aperçu à droite
4. GÉNÉRATION  Trois sorties depuis la fiche validée
5. SORTIE      Téléchargement PNG, copie du HTML, publication du slug
```

L'étape 3 n'est pas facultative. **Aucune sortie ne peut être générée depuis une
offre au statut brouillon.** Une erreur de prix dans une offre de voyage a un coût
réel et légal. Le passage par la validation humaine est une contrainte du domaine,
pas une préférence d'interface.

---

## 5. Modèle de données

### Table `offres`

Champs indépendants de la langue, en colonnes :

```sql
create table offres (
  id                    uuid primary key default gen_random_uuid(),
  slug                  text unique not null,
  statut                text not null default 'brouillon'
                        check (statut in ('brouillon','validee','publiee','archivee')),
  type_produit          text check (type_produit in ('forfait','croisiere','circuit')),
  fournisseur           text,

  destination_pays      text,
  destination_ville     text,
  date_depart           date,
  date_retour           date,
  duree_nuits           int,
  duree_jours           int,

  prix_par_personne     numeric(10,2),
  devise                text default 'CAD',
  occupation            text check (occupation in ('simple','double','triple','quadruple')),
  taxes_incluses        boolean default true,
  prix_valide_jusqua    date,

  compagnie_aerienne    text,
  aeroport_depart       text default 'YUL',
  aeroports_alternatifs text[],

  etablissement_nom     text,
  etablissement_type    text check (etablissement_type in ('hotel','navire','multiple')),
  etablissement_categorie text,

  lien_monarc           text,
  lien_tripadvisor      text,
  lien_reservation      text,

  vedette               boolean default false,

  source_fichier_url    text,
  source_url            text,
  extraction_brute      jsonb,
  contenus              jsonb not null default '{"fr":{},"en":null}',

  cree_le               timestamptz default now(),
  modifie_le            timestamptz default now()
);
```

Trois champs méritent une explication.

**`extraction_brute`** conserve la sortie originale de l'IA, jamais modifiée, à côté
de la version corrigée par l'humain. Après une trentaine d'offres, comparer les deux
révèle où l'extraction se trompe systématiquement — un format de date, une confusion
entre prix affiché et prix taxes incluses. C'est ce qui permet d'améliorer le prompt
sur des données réelles plutôt qu'à l'aveugle. Ne l'écrase jamais.

**`contenus`** est un JSONB localisé. L'interface est en français seulement pour la
v1, mais la dimension linguistique existe dès maintenant dans le modèle. La rajouter
après coup obligerait à retoucher chaque gabarit.

```jsonc
{
  "fr": {
    "titre": "Traversez le Canal de Panama",
    "accroche": "...",
    "inclusions": ["Vols aller-retour de Montréal", "..."],
    "exclusions": ["Assurance voyage", "..."],
    "itineraire": [{ "jour": 1, "titre": "Seattle", "texte": "..." }],
    "faq": [{ "q": "...", "r": "..." }],
    "visuel": { /* voir PostVisuel, section 6 */ }
  },
  "en": null
}
```

**`slug`** est généré à partir du titre, unique, immuable une fois l'offre publiée.
Une landing page dont l'URL change est une landing page perdue.

### Table `photos`

```sql
create table photos (
  id        uuid primary key default gen_random_uuid(),
  offre_id  uuid references offres(id) on delete cascade,
  url       text not null,
  ordre     int default 0,
  role      text check (role in ('hero','galerie')) default 'galerie',
  credit    text
);
```

Les photos sont téléversées à la main pour chaque offre. La photo `hero` sert de
fond au post social et d'image d'en-tête de la landing page. Il ne peut y en avoir
qu'une par offre.

### Tables `campagnes` et `campagne_offres`

```sql
create table campagnes (
  id            uuid primary key default gen_random_uuid(),
  nom           text not null,
  date_envoi    date,
  offre_vedette uuid references offres(id),
  statut        text default 'brouillon',
  cree_le       timestamptz default now()
);

create table campagne_offres (
  campagne_id uuid references campagnes(id) on delete cascade,
  offre_id    uuid references offres(id) on delete cascade,
  ordre       int not null,
  primary key (campagne_id, offre_id)
);
```

Une campagne correspond à un envoi Mailchimp. Elle désigne une offre vedette — celle
qui devient le post Facebook et Instagram — et ordonne les autres offres dans le
courriel.

---

## 6. Le gabarit visuel

C'est la partie la plus exigeante du projet. Quatre posts existants ont été analysés :
ils partagent un seul gabarit paramétrable avec deux variantes.

### Anatomie, de haut en bas

| Zone | Description |
|---|---|
| Cadre | Bordure en dégradé, teinte accordée à la photo, environ 12 px |
| Titre | Italique condensé gras, blanc, ombre portée, une ligne |
| Bandeau | Pastille blanche pleine largeur, flèche `→`, majuscules |
| Blocs | 2 à 4 pastilles blanches, italique, largeur épousant le texte |
| Prix | Bas gauche : surtitre, montant géant, mentions légales |
| Signature | Bas droite : logo, courriel, téléphone — identique partout |

### Éléments optionnels

- **Prix secondaire** : un second bloc de prix pour un supplément
  (« Plan boissons & wifi : +$504 »)
- **Badge** : pastille avec icône et texte court (« YQB — Départs de Québec possibles! »)

### Variantes

- **simple** : une colonne de blocs, un prix. Le cas courant.
- **double** : deux colonnes côte à côte, chacune avec son en-tête, ses blocs et son
  prix. Sert à présenter deux navires ou deux dates en comparaison.

### Schéma

```ts
// lib/templates/social/schema.ts
import { z } from "zod"

export const Prix = z.object({
  surtitre: z.string().max(24).default("À partir de seulement"),
  montant: z.number().int().positive(),
  mentions: z.array(z.string().max(22)).max(3),
})

export const Bloc = z.object({
  lignes: z.array(z.string().max(62)).min(1).max(2),
})

export const Colonne = z.object({
  entete: z.string().max(62).nullable(),
  blocs: z.array(Bloc).min(1).max(4),
  prix: Prix,
})

export const PostVisuel = z.object({
  variante: z.enum(["simple", "double"]),
  theme: z.enum(["framboise", "sarcelle", "azur", "ambre", "olive", "prune"]),
  photo: z.object({
    url: z.string().url(),
    focale: z.enum(["haut", "centre", "bas"]).default("centre"),
  }),
  titre: z.string().max(34),
  bandeau: z.string().max(58),
  colonnes: z.array(Colonne).min(1).max(2),
  prix_secondaire: Prix.nullable(),
  badge: z.object({ texte: z.string().max(30), icone: z.string() }).nullable(),
})

export type PostVisuel = z.infer<typeof PostVisuel>
```

### Pourquoi `lignes` est un tableau

Les pastilles blanches épousent la largeur de **chaque ligne individuellement**, pas
celle du bloc de texte entier. En CSS, ce comportement s'obtient avec
`box-decoration-break: clone`, que Satori ne prend pas en charge.

En stockant les lignes séparément, chaque ligne devient son propre `div` avec son
fond blanc et ses coins arrondis. Le rendu est fidèle, et l'opérateur contrôle les
coupures de ligne au lieu de les subir. Ne remplace pas ce tableau par une simple
chaîne de caractères.

### Gras partiel

Certains segments sont en gras au milieu d'un texte en italique régulier :
`CABINE BALCON`, `Pourboires OFFERTS`, `mid-ship`, `27 septembre 2026`.

Utilise un balisage minimal `**texte**` dans les chaînes, transformé en `<span>` au
moment du rendu. Écris une fonction utilitaire `parseGras(texte: string)` qui retourne
un tableau de segments typés. Elle sert au rendu Satori **et** à l'aperçu dans le
formulaire de validation.

---

## 7. Contraintes de rendu — à lire avant de coder le gabarit

### Format

**1080 × 1350 pixels, ratio 4:5.** Les visuels existants sont en 6:5 environ, un
ratio qui n'existe ni sur Facebook ni sur Instagram et qui sera recadré sur IG. Le
4:5 est le format le plus généreux accepté tel quel sur les deux plateformes. Une
seule génération, aucun recadrage.

### Polices

**Point de blocage potentiel — vérifie avant de coder.** Satori charge les polices
depuis des fichiers en mémoire, il ne lit pas un `@font-face` distant. Les gabarits
existants viennent de Canva et leur police d'affichage est possiblement sous licence
Canva uniquement, non redistribuable.

Si la licence bloque, cherche un équivalent libre pour cet italique condensé lourd :
Anton, Archivo Narrow ou Oswald en variante oblique. **Demande-moi confirmation avant
de choisir** — c'est une décision de marque, pas technique.

Les fichiers `.ttf` ou `.woff` vont dans `/public/fonts/` et sont chargés avec
`fs.readFileSync` au moment du rendu.

### Limite de bundle

Le bundle d'`ImageResponse` est plafonné à **500 Ko**, polices et images comprises. Le
dépassement produit des erreurs de déploiement Vercel difficiles à diagnostiquer. Le
gabarit a besoin de plusieurs styles de police (italique condensé gras, italique
régulier, gras), ce qui dépasse la limite avec des fichiers complets.

Conséquence : les polices **doivent** être sous-ensemblées avant d'entrer dans
`/public/fonts/`. Jeu de caractères minimal : latin de base, accents français
(`àâäçéèêëîïôöùûüÿ` et leurs majuscules), chiffres, et `$ & → ! ? ' ( ) , . : ; / +`.
Utilise `glyphhanger` ou `subset-font`. Objectif : **moins de 30 Ko par fichier**.
Documente la commande de sous-ensemblage dans le dépôt pour qu'elle soit reproductible.

### Le bloc signature

Ne le reconstruis pas en CSS. Le `.COM` pivoté à 90 degrés, la découpe arrondie
asymétrique, l'imbrication du logo — c'est beaucoup de travail pour un résultat
approximatif.

Exporte-le une fois en SVG, six versions, une par thème, dans `/public/signature/`.
Pose-le en calque absolu. Même chose pour le badge YQB.

### Limites de Satori

Pas de `float`, pas de `grid`, pas de `box-decoration-break`, support partiel des
transformations. Flexbox uniquement, avec `display: flex` explicite sur chaque
conteneur. Les dégradés linéaires fonctionnent. Les images doivent être des URL
absolues accessibles publiquement, ou des data URI.

---

## 8. Extraction

### Principe : deux appels séparés

L'extraction se fait en **deux appels distincts**, jamais fusionnés. La raison est un
risque métier : les contraintes de longueur ne portent pas sur les mêmes données que
les faits. Un prix ou une date n'a pas de limite de caractères ; seuls les textes
composés (titre, bandeau, lignes de blocs) sont contraints. Les mélanger dans un seul
appel signifie qu'une relance causée par un titre trop long fait **rejouer l'extraction
du prix**. Inacceptable sur une tâche où l'erreur de prix est le risque principal.

Les deux appels utilisent les structured outputs (`output_config.format` avec un
`json_schema` ; l'ancien `output_format` est déprécié). Rappel de la limite du JSON
Schema : il **ne supporte pas** `minLength`/`maxLength` ni `minimum`/`maximum` — les SDK
les retirent du schéma et les revalident côté client. Les structured outputs garantissent
donc la **forme** (champs, types, enums, `required`), et Zod garantit le reste.

### Appel 1 — Extraction (les faits)

- **Entrée** : le document (image, PDF, ou texte extrait d'une URL).
- **Sortie** : les faits seulement — ce qui alimente les colonnes de la table `offres`
  (`type_produit`, dates, prix, `occupation`, navire, aéroports, compagnie, liens…)
  plus les listes factuelles (`inclusions`, `exclusions`, `itineraire`).
- Structured outputs, `output_config` avec `json_schema`. **Aucune contrainte de
  longueur** dans ce schéma.
- Validation Zod côté client **limitée à la cohérence métier** : `date_retour` >
  `date_depart`, `prix_par_personne` > 0, `occupation` dans l'enum, etc.
- **Aucune relance automatique.** Si ça échoue, on affiche l'erreur à l'opérateur — on
  ne rejoue jamais une extraction de faits à l'aveugle.

### Appel 2 — Composition (le texte marketing)

- **Entrée** : les faits validés de l'appel 1, en JSON.
- **Sortie** : l'objet `PostVisuel` de la section 6 (titre, bandeau, colonnes, blocs)
  plus l'accroche et la FAQ.
- Structured outputs pour la forme ; Zod côté client pour les `.max()` de longueur.
- **UNE relance** en cas de dépassement, avec le message d'erreur Zod en retour et
  l'instruction de **raccourcir sans changer les faits**, puis échec propre.
- Ce prompt ne doit **jamais** inventer ni modifier un chiffre. Les prix et dates lui
  arrivent déjà validés ; il les recopie tels quels.

### Implémentation

- Route(s) : une route par étape, ou une route unique `POST /api/extraction` avec un
  paramètre d'étape (`{ offreId, etape: "extraction" | "composition" }`), au choix.
- Récupère le document depuis Storage, l'encode en base64.
- Les PDF passent nativement à l'API avec `type: "document"`, les images avec
  `type: "image"` et le bon `media_type`. Pour une URL, récupère le HTML et extrais le
  texte avant d'envoyer.
- **`extraction_brute` devient un objet à deux clés : `{ extraction, composition }`**,
  chacune conservant la sortie brute de l'appel correspondant. Jamais écrasé.
- La version validée finale va dans `contenus`.
- **Deux fichiers de prompt** : `lib/extraction/prompt.ts` et `lib/composition/prompt.ts`.
- **Régénération** : l'écran de validation (phase 3) aura un bouton « régénérer le
  texte » qui relance **l'appel 2 seul**, sur les faits déjà validés, sans retoucher aux
  faits. Prévoir cette séparation dans l'architecture dès maintenant, même si le bouton
  n'est codé qu'en phase 3.

### Règles pour le prompt système — Appel 1 (extraction)

- Les prix ne sont **jamais** inventés ni arrondis. Champ nul si illisible.
- Les dates au format ISO. Année explicite obligatoire.
- L'occupation doit être identifiée : simple, double, triple ou quadruple. C'est
  l'erreur la plus coûteuse — une cabine solo et une cabine double n'ont pas le
  même prix par personne.
- Distinguer prix affiché et prix taxes incluses.

### Règles pour le prompt système — Appel 2 (composition)

- Recopier les chiffres et dates fournis ; ne jamais les inventer ni les modifier.
- Respecter les limites de longueur du gabarit (le schéma Zod les revalide).
- Interdits stylistiques : tirets cadratins, triples adjectifs, formules d'ouverture
  toutes faites du genre « Découvrez » ou « Laissez-vous transporter ».
- Ton : direct, factuel, concret. Une information par bloc.

---

## 9. Arborescence

```
/app
  /(admin)
    /layout.tsx                 vérification de session
    /offres/page.tsx            liste, filtres par statut
    /offres/nouvelle/page.tsx   zone de glisser-déposer
    /offres/[id]/page.tsx       validation deux volets
    /offres/[id]/sorties/page.tsx
    /campagnes/page.tsx
    /campagnes/[id]/page.tsx    composition, réordonnancement
  /(public)
    /voyage/[slug]/page.tsx     landing page
  /api
    /extraction/route.ts        deux étapes : extraction (faits) puis composition (texte)
    /og/[id]/route.tsx          rendu PNG
    /email/[campagneId]/route.ts

/lib
  /schema/offre.ts              Zod — faits (cohérence métier, pas de longueur)
  /extraction/prompt.ts         Appel 1 — prompt système extraction des faits
  /extraction/client.ts         appel API + structured outputs (faits)
  /composition/prompt.ts        Appel 2 — prompt système composition du texte
  /composition/client.ts        appel API + structured outputs + relance longueur
  /templates/social/
    schema.ts
    Gabarit.tsx                 JSX pour Satori
    themes.ts
    parseGras.ts
  /templates/email/
    campagne.mjml.ts
  /supabase/

/public
  /fonts/
  /signature/
```

`lib/schema/offre.ts` est la pièce centrale. Un seul schéma Zod valide la sortie de
Claude, type le formulaire de validation et type les gabarits. Quand un champ change,
il change à un seul endroit et TypeScript signale tous les points d'impact.

---

## 10. Ordre de construction

Construis dans cet ordre. **Arrête-toi à la fin de chaque phase et attends ma
validation** avant d'attaquer la suivante.

**Phase 0** — Initialisation. Next.js, Tailwind, shadcn, connexion Supabase, migrations
SQL, authentification. Une page de liste vide qui se charge.

**Phase 1** — Ingestion. Glisser-déposer, envoi vers Storage, création de la ligne
`offres`, téléversement des photos avec désignation du hero.

**Phase 2** — Extraction. Le schéma Zod complet d'abord, puis le prompt, puis la
route. Testable sur les quatre captures d'écran fournies dans `/fixtures`.

**Phase 3** — Validation. Écran deux volets, formulaire react-hook-form, compteurs
de caractères sur les champs contraints, passage au statut validée.

**Phase 4** — Image sociale. Variante simple d'abord, sur les données du post Panama.
Compare avec l'original avant de coder la variante double.

**Phase 5** — Courriel. Gabarit MJML, compilation, page de copie du HTML.

**Phase 6** — Landing pages. Route publique, revalidation à la demande à la publication.

---

## 11. Règles de travail

**Ne devine pas.** Si une information manque — un champ, une règle métier, un choix
de marque — demande. Les données de voyage ont des contraintes légales; une
supposition raisonnable peut être fausse d'une manière coûteuse.

**Pas de dépendance nouvelle sans me demander.** La pile de la section 2 est arrêtée
quant aux **choix** de technologies. Les numéros de version peuvent évoluer : si une
version installée diffère de la spec, **signale-le et demande, ne downgrade pas
d'office.**

**Le français est la langue du domaine.** Les noms de tables, de colonnes et de
champs de schéma restent en français, comme documenté ici. L'interface est en
français. Les commentaires de code en français. Les noms de composants React en
anglais si tu préfères, peu importe.

**Aucune sortie depuis un brouillon.** Vérifie le statut côté serveur, pas seulement
dans l'interface.

**L'admin est laid et c'est voulu.** Si tu hésites entre soigner l'apparence du
panneau et avancer sur les gabarits de sortie, avance sur les gabarits.

---

## 12. À clarifier avant la phase 4

- [ ] Licence de la police d'affichage — vérification chez Canva
- [ ] Valeurs hexadécimales exactes des six thèmes de couleur
- [ ] Le gabarit HTML Mailchimp existant, s'il y en a un

> Note sur Mailchimp : si le gabarit vient d'un export HTML Canva, il ne fonctionnera
> pas. Canva produit des `div` en positionnement absolu, que Outlook et Gmail cassent
> systématiquement. Le design Canva sert de référence visuelle; le gabarit est
> reconstruit en MJML, qui compile vers des tableaux avec CSS inline. C'est une
> demi-journée de travail une fois, puis un gabarit paramétrable définitivement.

---

## 13. Jeu de données de test

Place les quatre captures d'écran de posts existants dans `/fixtures/posts/`. Elles
servent à valider le rendu du gabarit — l'objectif est qu'un visuel généré soit
indiscernable de l'original, au format près.

Voici la structure attendue pour le post « Canal de Panama », à utiliser comme
fixture de développement :

```ts
export const fixturePanama: PostVisuel = {
  variante: "simple",
  theme: "azur",
  photo: { url: "/fixtures/photos/panama.jpg", focale: "centre" },
  titre: "Traversez le Canal de Panama",
  bandeau: "FORFAIT D'UNE DURÉE DE 3 SEMAINES, DE SEATTLE À MIAMI",
  colonnes: [
    {
      entete: null,
      blocs: [
        { lignes: ["Vols, hôtels & croisière, départ le **27 septembre 2026**, vols de Montréal"] },
        { lignes: ["Une nuit avant (Seattle) et une nuit après la croisière (Miami)"] },
        { lignes: [
            "À l'itinéraire: Los Angeles, San Diego, Cabo San Lucas (Mexique),",
            "Puntarenas (Costa Rica), Cartagène (Colombie) et Miami",
        ]},
      ],
      prix: {
        surtitre: "À partir de seulement",
        montant: 2599,
        mentions: ["/personne,", "occ. double,", "taxes incluses."],
      },
    },
  ],
  prix_secondaire: null,
  badge: null,
}
```

Note que le troisième bloc dépasse 62 caractères sur sa première ligne dans
l'original. Ajuste la limite du schéma après avoir mesuré le rendu réel avec la
police définitive plutôt que de faire confiance à cette estimation.
