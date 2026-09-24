-- Verrouille toutes les tables du schéma public : aucun accès via les rôles
-- d'API (ex. anon/authenticated de Supabase). Le serveur de jeu se connecte
-- avec le rôle propriétaire des tables, qui n'est pas soumis à la RLS.
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END
$$;
