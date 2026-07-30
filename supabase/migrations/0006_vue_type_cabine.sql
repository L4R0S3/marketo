-- La landing page affiche le type de cabine (« Cabine balcon », « Studio solo
-- intérieur ») : c'est une information de premier plan pour une croisière, et
-- elle explique une bonne part de l'écart de prix. La colonne a été ajoutée en
-- 0004, APRÈS la création de la vue publique en 0002 : elle n'y figure donc pas.
--
-- Rappel de 0002 : la vue est en security_invoker = on, sinon elle tournerait
-- avec les droits de son propriétaire et exposerait les brouillons. Le grant
-- colonne sur offres reste nécessaire — RLS est row-level, pas column-level.
--
-- type_cabine est ajouté EN DERNIÈRE POSITION : « create or replace view »
-- n'autorise que l'ajout de colonnes à la fin, jamais l'insertion au milieu
-- (« cannot change name of view column »). Insérer ailleurs obligerait à
-- supprimer la vue, donc à recréer ses droits.

grant select (type_cabine) on offres to anon;

create or replace view offres_publiques
with (security_invoker = on) as
  select
    id, slug, type_produit,
    destination_pays, destination_ville,
    date_depart, date_retour, duree_nuits, duree_jours,
    prix_par_personne, devise, occupation, taxes_incluses,
    compagnie_aerienne, aeroport_depart,
    etablissement_nom, etablissement_type, etablissement_categorie,
    lien_reservation, contenus,
    type_cabine
  from offres
  where statut = 'publiee';

grant select on offres_publiques to anon;
