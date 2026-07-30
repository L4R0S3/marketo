-- A — Détail du prix.
-- prix_par_personne est TOUJOURS le total taxes incluses : c'est le seul montant
-- que le post affiche. Les systèmes fournisseurs (Sirev en tête) séparent
-- Prix / Taxes / Total ; on garde les trois pour que l'opérateur retrouve le
-- détail du document sans avoir à rouvrir la capture, et pour comparer plus tard
-- l'extraction à la correction humaine.
alter table offres
  add column prix_base numeric(10,2),
  add column taxes     numeric(10,2);

comment on column offres.prix_par_personne is 'Total par personne, taxes incluses. Seul prix affiché sur les sorties.';
comment on column offres.prix_base is 'Prix par personne avant taxes, si le document le sépare.';
comment on column offres.taxes is 'Montant des taxes par personne, si le document le sépare.';

-- B — Retrait des défauts fantômes.
-- 'YUL' et 'CAD' remplissaient silencieusement les colonnes quand l'extraction ne
-- trouvait rien dans le document, et la composition les reprenait ensuite comme
-- des faits : « Départ de Montréal (YUL) » s'est imprimé sur un post dont la
-- source ne mentionnait aucun aéroport. Une valeur non lue dans le document doit
-- rester NULL ; le formulaire de validation la suggère en placeholder, il ne la
-- pré-remplit pas.
alter table offres
  alter column aeroport_depart drop default,
  alter column devise          drop default;

-- Les lignes existantes qui portent encore la valeur par défaut ne sont PAS
-- touchées : impossible de distinguer après coup « lu dans le document » de
-- « posé par le défaut ». Seules les offres créées à partir de maintenant sont
-- propres.
