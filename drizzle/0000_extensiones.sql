-- Extensiones necesarias para el buscador (búsqueda aproximada y sin tildes).
-- Portátil: si existe el esquema "extensions" (Supabase) se instalan ahí, como recomienda Supabase;
-- en un PostgreSQL normal (Docker / servidor propio) se instalan en "public".
-- pg_trgm y unaccent son "trusted" desde PostgreSQL 13: el dueño de la base puede crearlas.
DO $$
DECLARE
  esquema text := CASE WHEN EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'extensions') THEN 'extensions' ELSE 'public' END;
BEGIN
  EXECUTE format('CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA %I', esquema);
  EXECUTE format('CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA %I', esquema);
END
$$;
--> statement-breakpoint
-- unaccent() no es IMMUTABLE, por eso se envuelve para poder usarla en índices y columnas calculadas.
-- Referencia completa al esquema y search_path fijo (buena práctica de seguridad).
DO $$
DECLARE
  esquema text;
BEGIN
  SELECT n.nspname INTO esquema
    FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
   WHERE e.extname = 'unaccent';
  EXECUTE format(
    'CREATE OR REPLACE FUNCTION public.f_unaccent(text) RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT SET search_path = '''' AS %L',
    format('SELECT %I.unaccent(%L::regdictionary, $1)', esquema, esquema || '.unaccent')
  );
END
$$;
