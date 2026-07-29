-- Machine Marketing — durcissement RLS, Storage, trigger, index, stratégie de slug.
-- Migration additive : ne modifie pas le schéma validé de 0001.

-- ═════════════════════════════════════════════════════════════
-- B — Trigger set_modifie_le : search_path figé (lint sécurité Supabase)
-- ═════════════════════════════════════════════════════════════
create or replace function set_modifie_le()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.modifie_le := pg_catalog.now();
  return new;
end;
$$;

-- ═════════════════════════════════════════════════════════════
-- C — Index sur les clés étrangères (Postgres ne les crée pas seul)
--     + index sur statut (filtre principal des listes)
-- ═════════════════════════════════════════════════════════════
create index on photos (offre_id);
create index on campagne_offres (offre_id);
create index on campagnes (offre_vedette);
create index on offres (statut);

-- ═════════════════════════════════════════════════════════════
-- D — Stratégie de slug : technique à la création, gelé à la publication
-- ═════════════════════════════════════════════════════════════
alter table offres
  add column slug_gele boolean not null default false;

-- Slug technique par défaut : jamais d'insertion en échec faute de titre.
alter table offres
  alter column slug set default
    ('brouillon-' || substr(md5(random()::text), 1, 8));

create or replace function gel_slug()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Geler dès la première publication.
  if new.statut = 'publiee' then
    new.slug_gele := true;
  end if;
  -- Une fois gelé, le slug est immuable (même après archivage).
  if old.slug_gele and new.slug is distinct from old.slug then
    raise exception 'Le slug d''une offre publiée est immuable (offre %).', old.id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger offres_gel_slug
  before update on offres
  for each row
  execute function gel_slug();

-- ═════════════════════════════════════════════════════════════
-- A — Accès public (anon) durci
--   1. La politique de ligne anon (offres publiées) vient de 0001.
--   2. Protection COLONNE : anon ne peut lire que les colonnes publiques,
--      même sur une offre publiée (RLS est row-level, pas column-level).
--   3. Vue offres_publiques en security_invoker=on : sinon la vue tournerait
--      avec les droits du propriétaire privilégié et ignorerait le RLS,
--      exposant les brouillons.
-- ═════════════════════════════════════════════════════════════
revoke select on offres from anon;
grant select (
  id, slug, type_produit,
  destination_pays, destination_ville,
  date_depart, date_retour, duree_nuits, duree_jours,
  prix_par_personne, devise, occupation, taxes_incluses,
  compagnie_aerienne, aeroport_depart,
  etablissement_nom, etablissement_type, etablissement_categorie,
  lien_reservation, contenus
) on offres to anon;

create view offres_publiques
with (security_invoker = on) as
  select
    id, slug, type_produit,
    destination_pays, destination_ville,
    date_depart, date_retour, duree_nuits, duree_jours,
    prix_par_personne, devise, occupation, taxes_incluses,
    compagnie_aerienne, aeroport_depart,
    etablissement_nom, etablissement_type, etablissement_categorie,
    lien_reservation, contenus
  from offres
  where statut = 'publiee';

grant select on offres_publiques to anon;

-- Photos : politique anon découplée du RLS de offres via une fonction
-- SECURITY DEFINER (sinon la sous-requête sur offres dépendrait des droits
-- colonne d'anon). Remplace la politique naïve de 0001.
drop policy photos_anon_publiees on photos;

create function est_offre_publiee(oid uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.offres where id = oid and statut = 'publiee'
  );
$$;

revoke execute on function est_offre_publiee(uuid) from public;
grant execute on function est_offre_publiee(uuid) to anon, authenticated;

create policy photos_anon_publiees on photos
  for select to anon
  using (est_offre_publiee(offre_id));

-- ═════════════════════════════════════════════════════════════
-- Storage — deux buckets
--   documents : PRIVÉ (sources : captures Sirev, PDF fournisseurs).
--               Tarifs nets / conditions contractuelles → jamais publics.
--               Accès par URL signée en session authentifiée.
--   photos    : PUBLIC (servi par les landing pages).
-- ═════════════════════════════════════════════════════════════
insert into storage.buckets (id, name, public)
values
  ('documents', 'documents', false),
  ('photos', 'photos', true)
on conflict (id) do nothing;

-- documents : réservé aux authentifiés (lecture via URL signée + gestion).
create policy "documents authentifie"
  on storage.objects for all to authenticated
  using (bucket_id = 'documents')
  with check (bucket_id = 'documents');

-- photos : lecture publique + gestion par les authentifiés.
create policy "photos lecture publique"
  on storage.objects for select to anon
  using (bucket_id = 'photos');

create policy "photos gestion authentifie"
  on storage.objects for all to authenticated
  using (bucket_id = 'photos')
  with check (bucket_id = 'photos');
