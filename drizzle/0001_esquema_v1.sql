CREATE TABLE "sesiones" (
	"id" text PRIMARY KEY NOT NULL,
	"usuario_id" integer NOT NULL,
	"expira_en" timestamp with time zone NOT NULL,
	"ip" text,
	"user_agent" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "usuarios_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"nombre" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"rol" text DEFAULT 'operador' NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"ultimo_acceso" timestamp with time zone,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "persona_alias" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "persona_alias_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"persona_id" integer NOT NULL,
	"alias" text NOT NULL,
	"alias_normalizado" text GENERATED ALWAYS AS (f_unaccent(lower(alias))) STORED,
	"origen" text DEFAULT 'manual' NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "personas" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "personas_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"nombres" text NOT NULL,
	"apellidos" text DEFAULT '' NOT NULL,
	"rut" text,
	"telefono" text,
	"email" text,
	"direccion" text,
	"comuna" text,
	"observaciones" text,
	"texto_busqueda" text GENERATED ALWAYS AS (f_unaccent(lower(nombres || ' ' || apellidos || ' ' || coalesce(rut, '') || ' ' || coalesce(telefono, '') || ' ' || coalesce(email, '')))) STORED,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"eliminado_en" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "buses" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "buses_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"numero" text NOT NULL,
	"patente" text,
	"descripcion" text,
	"capacidad" integer,
	"activo" boolean DEFAULT true NOT NULL,
	"observaciones" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"eliminado_en" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "servicios" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "servicios_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"nombre" text NOT NULL,
	"tipo" text DEFAULT 'escolar' NOT NULL,
	"descripcion" text,
	"tarifa_referencia" integer,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"eliminado_en" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "alumno_responsables" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "alumno_responsables_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"alumno_id" integer NOT NULL,
	"persona_id" integer NOT NULL,
	"es_apoderado" boolean DEFAULT true NOT NULL,
	"es_titular" boolean DEFAULT false NOT NULL,
	"es_pagador" boolean DEFAULT false NOT NULL,
	"parentesco" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alumnos" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "alumnos_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"persona_id" integer NOT NULL,
	"establecimiento" text,
	"curso" text,
	"bus_id" integer,
	"servicio_id" integer,
	"tarifa_mensual" integer DEFAULT 0 NOT NULL,
	"dia_vencimiento" smallint,
	"fecha_ingreso" date,
	"fecha_retiro" date,
	"estado" text DEFAULT 'activo' NOT NULL,
	"observaciones" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"eliminado_en" timestamp with time zone,
	CONSTRAINT "alumnos_tarifa_ck" CHECK ("alumnos"."tarifa_mensual" >= 0),
	CONSTRAINT "alumnos_dia_venc_ck" CHECK ("alumnos"."dia_vencimiento" is null or "alumnos"."dia_vencimiento" between 1 and 31)
);
--> statement-breakpoint
CREATE TABLE "documentos" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "documentos_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"nombre_original" text NOT NULL,
	"ruta" text NOT NULL,
	"mime" text NOT NULL,
	"tamano" bigint NOT NULL,
	"sha256" text NOT NULL,
	"tipo" text DEFAULT 'otro' NOT NULL,
	"entidad_tipo" text,
	"entidad_id" integer,
	"subido_por" integer,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"eliminado_en" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "importacion_filas" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "importacion_filas_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"importacion_id" integer NOT NULL,
	"numero_fila" integer NOT NULL,
	"datos_originales" jsonb NOT NULL,
	"datos" jsonb NOT NULL,
	"accion_propuesta" text NOT NULL,
	"registro_existente_id" integer,
	"registro_existente" jsonb,
	"diferencias" jsonb,
	"advertencias" jsonb,
	"decision" text,
	"estado" text DEFAULT 'pendiente' NOT NULL,
	"resultado_id" integer,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "importaciones" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "importaciones_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tipo_fuente" text NOT NULL,
	"destino" text NOT NULL,
	"documento_id" integer,
	"estado" text DEFAULT 'analizando' NOT NULL,
	"columnas" jsonb,
	"mapeo" jsonb,
	"opciones" jsonb,
	"extraccion_ia" jsonb,
	"resumen" jsonb,
	"error" text,
	"creado_por" integer,
	"aplicado_por" integer,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"aplicada_en" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "cierres_mes" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "cierres_mes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"periodo" date NOT NULL,
	"estado" text DEFAULT 'cerrado' NOT NULL,
	"resumen" jsonb NOT NULL,
	"cerrado_por" integer,
	"cerrado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"reabierto_por" integer,
	"reabierto_en" timestamp with time zone,
	"motivo_reapertura" text,
	CONSTRAINT "cierres_mes_periodo_unique" UNIQUE("periodo")
);
--> statement-breakpoint
CREATE TABLE "devoluciones" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "devoluciones_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"alumno_id" integer,
	"pago_id" integer,
	"persona_id" integer,
	"monto" integer NOT NULL,
	"motivo" text NOT NULL,
	"estado" text DEFAULT 'pendiente' NOT NULL,
	"fecha_solicitud" date NOT NULL,
	"fecha_realizada" date,
	"observaciones" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "devoluciones_monto_ck" CHECK ("devoluciones"."monto" > 0)
);
--> statement-breakpoint
CREATE TABLE "mensualidades" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "mensualidades_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"alumno_id" integer NOT NULL,
	"periodo" date NOT NULL,
	"monto" integer NOT NULL,
	"fecha_vencimiento" date NOT NULL,
	"monto_pagado" integer DEFAULT 0 NOT NULL,
	"estado" text DEFAULT 'pendiente' NOT NULL,
	"observaciones" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mensualidades_monto_ck" CHECK ("mensualidades"."monto" >= 0 and "mensualidades"."monto_pagado" >= 0)
);
--> statement-breakpoint
CREATE TABLE "movimientos_bancarios" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "movimientos_bancarios_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"banco" text,
	"cuenta" text,
	"fecha" date NOT NULL,
	"monto" integer NOT NULL,
	"descripcion" text,
	"nombre_contraparte" text,
	"rut_contraparte" text,
	"numero_operacion" text,
	"huella" text NOT NULL,
	"importacion_id" integer,
	"pago_id" integer,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pago_aplicaciones" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "pago_aplicaciones_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"pago_id" integer NOT NULL,
	"mensualidad_id" integer NOT NULL,
	"monto" integer NOT NULL,
	"creado_por" integer,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pago_aplicaciones_monto_ck" CHECK ("pago_aplicaciones"."monto" > 0)
);
--> statement-breakpoint
CREATE TABLE "pagos" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "pagos_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"fecha_pago" date NOT NULL,
	"monto" integer NOT NULL,
	"medio" text DEFAULT 'transferencia' NOT NULL,
	"banco" text,
	"numero_operacion" text,
	"nombre_origen" text,
	"rut_origen" text,
	"pagador_id" integer,
	"alumno_id" integer,
	"estado_verificacion" text DEFAULT 'verificado' NOT NULL,
	"estado_conciliacion" text DEFAULT 'por_conciliar' NOT NULL,
	"monto_aplicado" integer DEFAULT 0 NOT NULL,
	"origen" text DEFAULT 'manual' NOT NULL,
	"documento_id" integer,
	"importacion_id" integer,
	"observaciones" text,
	"anulado_en" timestamp with time zone,
	"motivo_anulacion" text,
	"registrado_por" integer,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pagos_monto_ck" CHECK ("pagos"."monto" > 0 and "pagos"."monto_aplicado" >= 0 and "pagos"."monto_aplicado" <= "pagos"."monto")
);
--> statement-breakpoint
CREATE TABLE "alertas" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "alertas_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"clave" text NOT NULL,
	"regla_codigo" text NOT NULL,
	"modulo" text NOT NULL,
	"nivel" text NOT NULL,
	"titulo" text NOT NULL,
	"detalle" text,
	"entidad_tipo" text,
	"entidad_id" integer,
	"enlace" text,
	"fecha_referencia" date,
	"estado" text DEFAULT 'activa' NOT NULL,
	"pospuesta_hasta" date,
	"nivel_descartado" text,
	"atendida_por" integer,
	"primera_vez" timestamp with time zone DEFAULT now() NOT NULL,
	"ultima_vez" timestamp with time zone DEFAULT now() NOT NULL,
	"resuelta_en" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "auditoria" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "auditoria_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"fecha" timestamp with time zone DEFAULT now() NOT NULL,
	"usuario_id" integer,
	"accion" text NOT NULL,
	"entidad" text NOT NULL,
	"entidad_id" text,
	"resumen" text,
	"antes" jsonb,
	"despues" jsonb,
	"cambios" jsonb,
	"motivo" text,
	"origen" text DEFAULT 'ui' NOT NULL,
	"periodo_cerrado" boolean DEFAULT false NOT NULL,
	"ip" text
);
--> statement-breakpoint
CREATE TABLE "configuracion" (
	"clave" text PRIMARY KEY NOT NULL,
	"valor" jsonb NOT NULL,
	"descripcion" text,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_por" integer
);
--> statement-breakpoint
CREATE TABLE "recordatorios" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "recordatorios_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"titulo" text NOT NULL,
	"detalle" text,
	"fecha" date NOT NULL,
	"entidad_tipo" text,
	"entidad_id" integer,
	"estado" text DEFAULT 'pendiente' NOT NULL,
	"creado_por" integer,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"completado_en" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "reglas_alerta" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "reglas_alerta_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"codigo" text NOT NULL,
	"modulo" text NOT NULL,
	"nombre" text NOT NULL,
	"descripcion" text,
	"activa" boolean DEFAULT true NOT NULL,
	"umbrales" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"parametros" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_por" integer,
	CONSTRAINT "reglas_alerta_codigo_unique" UNIQUE("codigo")
);
--> statement-breakpoint
ALTER TABLE "sesiones" ADD CONSTRAINT "sesiones_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "persona_alias" ADD CONSTRAINT "persona_alias_persona_id_personas_id_fk" FOREIGN KEY ("persona_id") REFERENCES "public"."personas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alumno_responsables" ADD CONSTRAINT "alumno_responsables_alumno_id_alumnos_id_fk" FOREIGN KEY ("alumno_id") REFERENCES "public"."alumnos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alumno_responsables" ADD CONSTRAINT "alumno_responsables_persona_id_personas_id_fk" FOREIGN KEY ("persona_id") REFERENCES "public"."personas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alumnos" ADD CONSTRAINT "alumnos_persona_id_personas_id_fk" FOREIGN KEY ("persona_id") REFERENCES "public"."personas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alumnos" ADD CONSTRAINT "alumnos_bus_id_buses_id_fk" FOREIGN KEY ("bus_id") REFERENCES "public"."buses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alumnos" ADD CONSTRAINT "alumnos_servicio_id_servicios_id_fk" FOREIGN KEY ("servicio_id") REFERENCES "public"."servicios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_subido_por_usuarios_id_fk" FOREIGN KEY ("subido_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "importacion_filas" ADD CONSTRAINT "importacion_filas_importacion_id_importaciones_id_fk" FOREIGN KEY ("importacion_id") REFERENCES "public"."importaciones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "importaciones" ADD CONSTRAINT "importaciones_documento_id_documentos_id_fk" FOREIGN KEY ("documento_id") REFERENCES "public"."documentos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "importaciones" ADD CONSTRAINT "importaciones_creado_por_usuarios_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "importaciones" ADD CONSTRAINT "importaciones_aplicado_por_usuarios_id_fk" FOREIGN KEY ("aplicado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cierres_mes" ADD CONSTRAINT "cierres_mes_cerrado_por_usuarios_id_fk" FOREIGN KEY ("cerrado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cierres_mes" ADD CONSTRAINT "cierres_mes_reabierto_por_usuarios_id_fk" FOREIGN KEY ("reabierto_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devoluciones" ADD CONSTRAINT "devoluciones_alumno_id_alumnos_id_fk" FOREIGN KEY ("alumno_id") REFERENCES "public"."alumnos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devoluciones" ADD CONSTRAINT "devoluciones_pago_id_pagos_id_fk" FOREIGN KEY ("pago_id") REFERENCES "public"."pagos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devoluciones" ADD CONSTRAINT "devoluciones_persona_id_personas_id_fk" FOREIGN KEY ("persona_id") REFERENCES "public"."personas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mensualidades" ADD CONSTRAINT "mensualidades_alumno_id_alumnos_id_fk" FOREIGN KEY ("alumno_id") REFERENCES "public"."alumnos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_bancarios" ADD CONSTRAINT "movimientos_bancarios_importacion_id_importaciones_id_fk" FOREIGN KEY ("importacion_id") REFERENCES "public"."importaciones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_bancarios" ADD CONSTRAINT "movimientos_bancarios_pago_id_pagos_id_fk" FOREIGN KEY ("pago_id") REFERENCES "public"."pagos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pago_aplicaciones" ADD CONSTRAINT "pago_aplicaciones_pago_id_pagos_id_fk" FOREIGN KEY ("pago_id") REFERENCES "public"."pagos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pago_aplicaciones" ADD CONSTRAINT "pago_aplicaciones_mensualidad_id_mensualidades_id_fk" FOREIGN KEY ("mensualidad_id") REFERENCES "public"."mensualidades"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pago_aplicaciones" ADD CONSTRAINT "pago_aplicaciones_creado_por_usuarios_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_pagador_id_personas_id_fk" FOREIGN KEY ("pagador_id") REFERENCES "public"."personas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_alumno_id_alumnos_id_fk" FOREIGN KEY ("alumno_id") REFERENCES "public"."alumnos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_documento_id_documentos_id_fk" FOREIGN KEY ("documento_id") REFERENCES "public"."documentos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_importacion_id_importaciones_id_fk" FOREIGN KEY ("importacion_id") REFERENCES "public"."importaciones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_registrado_por_usuarios_id_fk" FOREIGN KEY ("registrado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alertas" ADD CONSTRAINT "alertas_atendida_por_usuarios_id_fk" FOREIGN KEY ("atendida_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "configuracion" ADD CONSTRAINT "configuracion_actualizado_por_usuarios_id_fk" FOREIGN KEY ("actualizado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recordatorios" ADD CONSTRAINT "recordatorios_creado_por_usuarios_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reglas_alerta" ADD CONSTRAINT "reglas_alerta_actualizado_por_usuarios_id_fk" FOREIGN KEY ("actualizado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sesiones_usuario_idx" ON "sesiones" USING btree ("usuario_id");--> statement-breakpoint
CREATE UNIQUE INDEX "usuarios_email_uq" ON "usuarios" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "persona_alias_uq" ON "persona_alias" USING btree ("persona_id","alias_normalizado");--> statement-breakpoint
CREATE INDEX "persona_alias_trgm" ON "persona_alias" USING gin ("alias_normalizado" gin_trgm_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "personas_rut_uq" ON "personas" USING btree ("rut") WHERE "personas"."rut" is not null and "personas"."eliminado_en" is null;--> statement-breakpoint
CREATE INDEX "personas_busqueda_trgm" ON "personas" USING gin ("texto_busqueda" gin_trgm_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "buses_numero_uq" ON "buses" USING btree ("numero") WHERE "buses"."eliminado_en" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "buses_patente_uq" ON "buses" USING btree ("patente") WHERE "buses"."patente" is not null and "buses"."eliminado_en" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "servicios_nombre_uq" ON "servicios" USING btree (lower("nombre")) WHERE "servicios"."eliminado_en" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "alumno_responsables_uq" ON "alumno_responsables" USING btree ("alumno_id","persona_id");--> statement-breakpoint
CREATE INDEX "alumno_responsables_persona_idx" ON "alumno_responsables" USING btree ("persona_id");--> statement-breakpoint
CREATE UNIQUE INDEX "alumnos_persona_uq" ON "alumnos" USING btree ("persona_id") WHERE "alumnos"."eliminado_en" is null;--> statement-breakpoint
CREATE INDEX "alumnos_bus_idx" ON "alumnos" USING btree ("bus_id");--> statement-breakpoint
CREATE INDEX "alumnos_servicio_idx" ON "alumnos" USING btree ("servicio_id");--> statement-breakpoint
CREATE INDEX "documentos_entidad_idx" ON "documentos" USING btree ("entidad_tipo","entidad_id");--> statement-breakpoint
CREATE INDEX "documentos_sha_idx" ON "documentos" USING btree ("sha256");--> statement-breakpoint
CREATE UNIQUE INDEX "importacion_filas_uq" ON "importacion_filas" USING btree ("importacion_id","numero_fila");--> statement-breakpoint
CREATE UNIQUE INDEX "mensualidades_alumno_periodo_uq" ON "mensualidades" USING btree ("alumno_id","periodo");--> statement-breakpoint
CREATE INDEX "mensualidades_periodo_idx" ON "mensualidades" USING btree ("periodo");--> statement-breakpoint
CREATE INDEX "mensualidades_estado_idx" ON "mensualidades" USING btree ("estado");--> statement-breakpoint
CREATE UNIQUE INDEX "movimientos_huella_uq" ON "movimientos_bancarios" USING btree ("huella");--> statement-breakpoint
CREATE INDEX "movimientos_fecha_idx" ON "movimientos_bancarios" USING btree ("fecha");--> statement-breakpoint
CREATE UNIQUE INDEX "pago_aplicaciones_uq" ON "pago_aplicaciones" USING btree ("pago_id","mensualidad_id");--> statement-breakpoint
CREATE INDEX "pago_aplicaciones_mensualidad_idx" ON "pago_aplicaciones" USING btree ("mensualidad_id");--> statement-breakpoint
CREATE INDEX "pagos_fecha_idx" ON "pagos" USING btree ("fecha_pago");--> statement-breakpoint
CREATE INDEX "pagos_alumno_idx" ON "pagos" USING btree ("alumno_id");--> statement-breakpoint
CREATE INDEX "pagos_pagador_idx" ON "pagos" USING btree ("pagador_id");--> statement-breakpoint
CREATE INDEX "pagos_estados_idx" ON "pagos" USING btree ("estado_verificacion","estado_conciliacion");--> statement-breakpoint
CREATE INDEX "pagos_operacion_idx" ON "pagos" USING btree ("numero_operacion");--> statement-breakpoint
CREATE UNIQUE INDEX "alertas_clave_uq" ON "alertas" USING btree ("clave");--> statement-breakpoint
CREATE INDEX "alertas_estado_nivel_idx" ON "alertas" USING btree ("estado","nivel");--> statement-breakpoint
CREATE INDEX "alertas_entidad_idx" ON "alertas" USING btree ("entidad_tipo","entidad_id");--> statement-breakpoint
CREATE INDEX "auditoria_entidad_idx" ON "auditoria" USING btree ("entidad","entidad_id");--> statement-breakpoint
CREATE INDEX "auditoria_fecha_idx" ON "auditoria" USING btree ("fecha");--> statement-breakpoint
CREATE INDEX "auditoria_usuario_idx" ON "auditoria" USING btree ("usuario_id");--> statement-breakpoint
CREATE INDEX "recordatorios_fecha_idx" ON "recordatorios" USING btree ("estado","fecha");