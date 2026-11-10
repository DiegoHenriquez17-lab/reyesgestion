-- SEGURIDAD: activa Row Level Security (RLS) en todas las tablas del esquema public.
-- La aplicación se conecta como dueña de las tablas, por lo que RLS no la afecta.
-- En Supabase bloquea el acceso a los datos por la API REST/GraphQL automática
-- (roles "anon" y "authenticated"): sin políticas, esos roles no ven ninguna fila.
-- En un PostgreSQL normal no cambia nada para la aplicación.
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END
$$;
