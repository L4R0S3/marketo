-- Machine Marketing — schéma initial (spec section 5)
-- Noms de tables et colonnes en français (langue du domaine).

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────
-- Table offres
-- ─────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────
-- Table photos
-- ─────────────────────────────────────────────────────────────
create table photos (
  id        uuid primary key default gen_random_uuid(),
  offre_id  uuid references offres(id) on delete cascade,
  url       text not null,
  ordre     int default 0,
  role      text check (role in ('hero','galerie')) default 'galerie',
  credit    text
);

-- Une seule photo hero par offre.
create unique index photos_une_hero_par_offre
  on photos (offre_id)
  where role = 'hero';

-- ─────────────────────────────────────────────────────────────
-- Tables campagnes
-- ─────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────
-- Trigger : modifie_le sur update d'une offre
-- ─────────────────────────────────────────────────────────────
create or replace function set_modifie_le()
returns trigger
language plpgsql
as $$
begin
  new.modifie_le = now();
  return new;
end;
$$;

create trigger offres_modifie_le
  before update on offres
  for each row
  execute function set_modifie_le();

-- ─────────────────────────────────────────────────────────────
-- RLS
-- L'app interne n'a qu'un niveau : « connecté ou non ».
-- Les landing pages publiques lisent les offres publiées (anon).
-- ─────────────────────────────────────────────────────────────
alter table offres enable row level security;
alter table photos enable row level security;
alter table campagnes enable row level security;
alter table campagne_offres enable row level security;

-- Utilisateurs authentifiés : accès complet à tout.
create policy offres_authenticated_all on offres
  for all to authenticated using (true) with check (true);

create policy photos_authenticated_all on photos
  for all to authenticated using (true) with check (true);

create policy campagnes_authenticated_all on campagnes
  for all to authenticated using (true) with check (true);

create policy campagne_offres_authenticated_all on campagne_offres
  for all to authenticated using (true) with check (true);

-- Public (anon) : lecture seule des offres publiées et de leurs photos.
create policy offres_anon_publiees on offres
  for select to anon using (statut = 'publiee');

create policy photos_anon_publiees on photos
  for select to anon using (
    exists (
      select 1 from offres o
      where o.id = photos.offre_id and o.statut = 'publiee'
    )
  );
