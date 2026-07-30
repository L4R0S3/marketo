-- Prix barré du gabarit courriel : le tarif régulier, affiché rayé au-dessus du
-- prix courant quand le document en annonce un. Optionnel de bout en bout — sans
-- lui, le bloc courriel n'affiche tout simplement pas de prix barré.
--
-- Rappel : prix_par_personne reste le total taxes incluses, seul montant mis en
-- avant ; prix_base et taxes (0005) sont la décomposition du document.
alter table offres add column prix_avant_rabais numeric(10,2);

comment on column offres.prix_avant_rabais is
  'Tarif régulier avant rabais, par personne. Affiché barré dans le courriel.';
