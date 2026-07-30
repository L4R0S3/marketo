# État du projet et point de reprise

> Document de passation, tenu à jour à la main. `CLAUDE.md` reste la **spécification**
> (ce qu'on veut) ; ce fichier dit **où on en est** et **ce qui reste**.
>
> Dernière mise à jour : 30 juillet 2026.

## En un coup d'œil

Les six phases prévues sont codées. L'application tourne en local et est déployée sur
Vercel. Une offre réelle a fait le parcours complet, du dépôt Sirev jusqu'à la landing
page publiée.

| Phase | État |
|---|---|
| 0 — Initialisation, Supabase, auth | fait, validé |
| 1 — Ingestion (dépôt fichier / URL, photos) | fait |
| 2 — Extraction IA (2 appels) | fait, testé en réel sur 5 documents |
| 3 — Écran de validation | fait |
| 4 — Post social (Satori + frames PNG) | fait, testé en réel |
| 5 — Courriel MJML + campagnes | fait |
| 6 — Landing pages + publication | fait, testé en réel |

## Ce qui reste à faire

1. **Déploiement Vercel — deux réglages à finir** (voir la section dédiée plus bas).
2. **Tester le parcours complet en ligne**, une fois le déploiement sain.
3. **Phase 4, points de marque restés ouverts** : les frames `framboise` et `ambre` de
   la série d'origine n'existent pas ; il y a aujourd'hui sept thèmes (azur, sarcelle,
   lagon, menthe, olive, prune, framboise). La signature vient des frames, plus du code.
4. **Confort** : le bouton « régénérer le texte » ne conserve pas les retouches manuelles,
   il remplace tout — comportement voulu, mais à surveiller à l'usage.

## Commandes utiles

```bash
npm run dev              # serveur de développement
npm run build            # construction, à passer avant tout commit
npm run lint

npm run test:securite    # 6 tests RLS de bout en bout — à rejouer après tout changement RLS
npm run test:schema      # compte les 2 budgets des structured outputs (voir plus bas)
npm run test:extraction  # Appel 1 sur les captures de fixtures/posts/ (motif facultatif)
npm run test:composition # chaîne Appel 1 → Appel 2 sur une capture
npm run test:formulaire  # 31 vérifications à froid des fonctions pures
npm run test:courriel    # compile les gabarits courriel dans rendus/
npm run rendu            # rend le post social en PNG dans rendus/
npm run polices          # re-télécharge et sous-ensemble Anton + Raleway
```

`rendus/` est ignoré par git : c'est un dossier de travail.

## Décisions structurantes, et pourquoi

### Extraction — la stratégie « sentinelles »

Les structured outputs imposent **deux plafonds** mesurés en conditions réelles :
**≤ 16 paramètres à union** et **≤ 24 paramètres facultatifs**, objets imbriqués compris.
Le schéma des faits en comptait une quarantaine : aucune extraction ne partait (400).

Règle retenue, sans exception : presque tout est **requis**, et l'absence s'exprime par une
**sentinelle** — `""` pour les chaînes et les enums, `[]` pour les listes. Seuls les nombres,
les booléens et les objets sont `.optional()`. La conversion `"" → null` se fait dans
`lib/extraction/sentinelles.ts`, **après** le parse et **avant** toute écriture.

`npm run test:schema` recompte les deux budgets sur le JSON Schema réellement généré :
**à relancer après toute modification de `lib/schema/offre.ts`.**

### Prix — une seule règle

`prix_par_personne` est **toujours le total taxes incluses** : c'est le seul montant affiché
sur les sorties. `prix_base` et `taxes` conservent la décomposition du document (Sirev
sépare Prix / Taxes / Total), `prix_avant_rabais` alimente le prix barré du courriel.
Sans cette règle, le même document donnait 2249 $ ou 2839 $ selon l'exécution.

Piège Sirev : la colonne **Grtot** est le total pour deux voyageurs, elle ne va nulle part.

### Aucune valeur inventée

Les défauts de colonne `'YUL'` et `'CAD'` ont été **retirés** (migration 0005) : ils
remplissaient silencieusement les trous et la composition les reprenait ensuite comme des
faits — « Départ de Montréal (YUL) » s'est imprimé sur un post dont la source ne mentionnait
aucun aéroport. Un champ vide veut dire « le document ne le dit pas ».

### Post social — les frames font tout le décor

Les sept PNG de `public/frames/` portent le cadre, le dégradé, le voile et la signature.
`lib/templates/social/Gabarit.tsx` ne place plus que du texte, en trois couches : photo,
frame, texte. Géométrie commune mesurée sur le canal alpha (`GEOMETRIE` dans `themes.ts`) :

- bandeau opaque de **211 px** en haut → c'est là que se pose le titre ;
- bordure de **22 px** → bord gauche des pastilles ;
- coin supérieur gauche **coupé en diagonale**, de x=178 à y=215 jusqu'à x=22 à y=400 →
  le contenu commence sous cette ligne, sinon une pastille chevaucherait le cadre ;
- bloc signature à partir de **x=560** → le prix reste à sa gauche.

**Ajouter un thème = déposer le PNG dans `public/frames/` et ajouter une ligne à
`THEME_IDS` et `THEMES`.** Le schéma Zod, le formulaire et les pastilles en dérivent.

Satori ne mesure pas le texte avant de rendre : `tailleQuiTient()` calcule la taille du
titre et du bandeau d'après leur longueur, sinon ils passent à la ligne.

### L'aperçu doit utiliser les vraies polices

`globals.css` déclare en `@font-face` les fichiers sous-ensemblés qu'utilise Satori.
Sans cela, l'aperçu rendait le titre en Geist — bien plus large qu'Anton — et le titre
débordait sous le cadre alors que le PNG tenait sur une ligne.

### Courriel

MJML **5 compile de façon asynchrone** (la 4 était synchrone) : sans `await`, `html` vaut
`undefined` sans la moindre erreur. Aucun emoji dans les gabarits, Outlook les casse.
Les liens sont absolus, d'où `NEXT_PUBLIC_SITE_URL`.

### Publication

`validee → publiee` gèle le slug (trigger `gel_slug`, migration 0002), **définitivement**,
même après archivage. C'est pourquoi la validation — qui régénère le slug depuis le titre —
doit passer avant. La landing page étant générée statiquement, `publierOffre` et
`archiverOffre` appellent `revalidatePath('/voyage/<slug>')` : sans ça, la page resterait
absente jusqu'au déploiement suivant.

## Base de données

Migrations `0001` à `0007`, toutes appliquées sur le projet Supabase `Marketo`
(ref `ndqbpvgjnfjyirahzfbs`, ca-central-1).

```bash
./node_modules/.bin/supabase db push   # sandbox réseau désactivé
```

`create or replace view` n'autorise l'ajout de colonnes **qu'en dernière position** :
insérer au milieu donne « cannot change name of view column ».

Réglage critique qui vit **hors du dépôt** : « Allow new users to sign up » doit rester
**décoché** dans le Dashboard Supabase. `npm run test:securite` le vérifie.

## Déploiement Vercel

- Projet : **`marketo`**, espace `l4r0s3s-projects`
- Dépôt : **github.com/L4R0S3/marketo**, branche `master`
- Domaine : `marketo-ochre.vercel.app`

### Deux réglages restent à finir

1. **Branche de production.** Vercel ne considère pas `master` comme la branche de
   production : une poussée y crée un déploiement d'**aperçu**. À corriger dans
   *Settings → Git → Production Branch* (mettre `master`), ou renommer la branche en `main`.
2. **Protection de déploiement.** *Settings → Deployment Protection → Vercel Authentication*
   doit être **désactivée** (ou limitée aux aperçus) pour que les landing pages soient
   visibles du public. Sans cela, un client cliquant un lien de courriel tombe sur une page
   de connexion Vercel.

### Piège déjà rencontré, déjà corrigé

Le projet avait été créé avec `vercel project add`, qui ne pose **aucun préréglage de
framework**. Sans framework, le dossier de sortie par défaut est `public/` : Vercel
déployait les polices et les frames comme un site statique et ignorait la sortie de
`next build`. Toutes les routes répondaient 404 alors que le build était sain.
`vercel.json` fixe désormais `"framework": "nextjs"`, indépendamment du tableau de bord.

### Variables d'environnement

Quatre sur Vercel (Production, Preview, Development) : `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`.

Reste à poser **`NEXT_PUBLIC_SITE_URL`** = le domaine public, sans barre oblique finale,
puis **redéployer** : les variables `NEXT_PUBLIC_` sont figées au moment du build.

## Environnement de travail (Windows)

- **Ne jamais écrire un fichier du dépôt avec `Set-Content` ou `Out-File`** : l'encodage est
  détruit (accents doublement encodés, BOM ajouté). C'est arrivé deux fois, sur
  `package.json` puis sur `globals.css`. Utiliser un éditeur, ou
  `[IO.File]::WriteAllText(chemin, texte, (New-Object Text.UTF8Encoding $false))`.
- Les crochets de `[id]` dans les chemins sont des **jokers PowerShell** : utiliser
  `-LiteralPath`.
- Les messages de commit multi-lignes passent par `git commit -F fichier`.

## Données réelles en base

Une offre publiée : **santo-domingo-tout-inclus-7-nuits** (Emotions By Hodelpa Juan Dolio,
2839 $ taxes incluses). Quelques brouillons de test issus de dépôts Sirev.
