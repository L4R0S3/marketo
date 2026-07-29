-- Fix : la vue offres_publiques est en security_invoker=on. Sa clause
-- « where statut = 'publiee' » est donc évaluée avec les droits d'anon, qui
-- doit pouvoir lire la colonne statut (elle n'était pas dans le grant colonne
-- de 0002). statut n'est pas une donnée sensible ; la policy de ligne limite
-- de toute façon anon aux offres publiées.
grant select (statut) on offres to anon;
