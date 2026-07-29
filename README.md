# Machine Marketing — Aéroport Voyage

Outil interne de génération de matériel marketing (post social, bloc courriel, landing
pages) à partir d'offres fournisseurs. **La spec fait autorité : voir [`CLAUDE.md`](./CLAUDE.md).**

Pile : Next.js 16 (App Router, TS strict) · Tailwind v4 · shadcn/ui · Supabase · Vercel.

---

## Branchement Supabase (Windows) — à faire avant la phase 1

Tant que ces étapes ne sont pas faites, l'app ne charge pas (aucune base). Commandes
exactes, dans l'ordre.

### 1. Installer le CLI Supabase

Le CLI est déjà en `devDependency` du projet : utilise `npx supabase`. (Alternative
sans Node : `scoop install supabase`.)

```powershell
npx supabase --version
```

### 2. Créer le projet hébergé

Sur https://supabase.com → **New project**. Note le mot de passe de la base et la
**Project Ref** (Project Settings → General → « Reference ID », format `abcdefgh…`).

### 3. Désactiver l'inscription publique ⚠️

Notre clé `anon` part dans le bundle navigateur des landing pages : elle est **publique**.
Avec l'inscription ouverte, n'importe qui pourrait se créer un compte et hériter de
l'accès `authenticated` (accès complet). À couper immédiatement :

**Dashboard → Authentication → Sign In / Providers → Email →** décocher
**« Allow new users to sign up »**, puis **Save**.

> Les comptes se créent **uniquement par invitation** depuis le tableau de bord
> (étape 7). Pas d'auto-inscription.

### 4. Récupérer les clés → `.env.local`

**Dashboard → Project Settings → API.** Copie l'URL et la clé `anon` (`publishable`)
dans un fichier `.env.local` à la racine (modèle : `.env.example`) :

```
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<clé anon>
```

### 5. Lier le projet et pousser les migrations

```powershell
npx supabase login
npx supabase link --project-ref <ref>
npx supabase db push
```

`db push` applique `0001_init.sql` puis `0002_rls_storage_slug.sql` : tables, RLS,
**les deux buckets Storage** (`documents` privé, `photos` public), triggers, index,
stratégie de slug.

### 6. Vérifier les buckets

**Dashboard → Storage.** Confirme la présence de `documents` (privé) et `photos`
(public). Ils sont créés par la migration 0002 — rien à créer à la main.

### 7. Créer ton compte

**Dashboard → Authentication → Users → Add user** (ou *Invite*). Courriel + mot de
passe. C'est le seul moyen de créer un compte (inscription publique coupée à l'étape 3).

### 8. Tester le RLS public ⚠️ (obligatoire)

**Dashboard → SQL Editor.** Colle et exécute ce test : une offre `brouillon` ne doit
**jamais** être visible via la vue publique pour le rôle `anon`.

```sql
begin;
insert into offres (statut, destination_pays) values ('brouillon', 'ZZBROUILLON');
insert into offres (statut, destination_pays) values ('publiee',   'ZZPUBLIEE');

set local role anon;

-- ATTENDU : une seule ligne, « ZZPUBLIEE ». « ZZBROUILLON » ne doit PAS apparaître.
select destination_pays
from offres_publiques
where destination_pays in ('ZZBROUILLON', 'ZZPUBLIEE');

reset role;
rollback;
```

Vérification bonus (protection colonne) — doit renvoyer **permission denied** :

```sql
set local role anon;
select extraction_brute from offres limit 1;  -- doit échouer
reset role;
```

### 9. Lancer l'app

```powershell
npm run dev
```

Ouvre http://localhost:3000 → redirection vers `/connexion` → connexion avec le compte
de l'étape 7 → `/offres` (liste vide).

---

## Développement

```powershell
npm run dev     # serveur de dev (Turbopack)
npm run build   # build de production
npm run lint    # ESLint
```

Nouvelle migration : `npx supabase migration new <nom>` (crée un fichier horodaté dans
`supabase/migrations/`), puis `npx supabase db push`.
