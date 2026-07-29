-- Le type de cabine (balcon, intérieure, studio solo) est une propriété de
-- l'offre, centrale au prix (~40% d'écart entre balcon et intérieure), et de
-- premier plan sur le post social et la landing page. Distinct de la catégorie
-- de l'établissement (étoiles d'hôtel, classe de navire), qui reste dans
-- etablissement_categorie.
alter table offres add column type_cabine text;
