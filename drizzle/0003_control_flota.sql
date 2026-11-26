CREATE TABLE "conductores" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "conductores_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"persona_id" integer NOT NULL,
	"clase_licencia" text,
	"activo" boolean DEFAULT true NOT NULL,
	"observaciones" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conductores_personaId_unique" UNIQUE("persona_id")
);
--> statement-breakpoint
CREATE TABLE "documentos_control" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "documentos_control_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"bus_id" integer,
	"conductor_id" integer,
	"documento_id" integer,
	"tipo" text NOT NULL,
	"fecha_emision" date,
	"fecha_vencimiento" date NOT NULL,
	"observaciones" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"eliminado_en" timestamp with time zone,
	CONSTRAINT "documentos_control_un_titular" CHECK (num_nonnulls("documentos_control"."bus_id", "documentos_control"."conductor_id") = 1),
	CONSTRAINT "documentos_control_fechas" CHECK ("documentos_control"."fecha_emision" <= "documentos_control"."fecha_vencimiento")
);
--> statement-breakpoint
CREATE TABLE "lecturas_kilometraje" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "lecturas_kilometraje_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"bus_id" integer NOT NULL,
	"fecha" date NOT NULL,
	"kilometraje" integer NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lecturas_kilometraje_positivo" CHECK ("lecturas_kilometraje"."kilometraje" >= 0)
);
--> statement-breakpoint
CREATE TABLE "mantenciones" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "mantenciones_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"plan_id" integer,
	"bus_id" integer NOT NULL,
	"tarea" text NOT NULL,
	"fecha" date NOT NULL,
	"kilometraje" integer,
	"costo" integer NOT NULL,
	"observaciones" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "planes_mantencion" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "planes_mantencion_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"bus_id" integer NOT NULL,
	"tarea" text NOT NULL,
	"proxima_fecha" date,
	"proximo_km" integer,
	"intervalo_dias" integer,
	"intervalo_km" integer,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "planes_mantencion_activo_con_plazo" CHECK (not "planes_mantencion"."activo" or num_nonnulls("planes_mantencion"."proxima_fecha", "planes_mantencion"."proximo_km") > 0)
);
--> statement-breakpoint
ALTER TABLE "conductores" ADD CONSTRAINT "conductores_persona_id_personas_id_fk" FOREIGN KEY ("persona_id") REFERENCES "public"."personas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos_control" ADD CONSTRAINT "documentos_control_bus_id_buses_id_fk" FOREIGN KEY ("bus_id") REFERENCES "public"."buses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos_control" ADD CONSTRAINT "documentos_control_conductor_id_conductores_id_fk" FOREIGN KEY ("conductor_id") REFERENCES "public"."conductores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos_control" ADD CONSTRAINT "documentos_control_documento_id_documentos_id_fk" FOREIGN KEY ("documento_id") REFERENCES "public"."documentos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lecturas_kilometraje" ADD CONSTRAINT "lecturas_kilometraje_bus_id_buses_id_fk" FOREIGN KEY ("bus_id") REFERENCES "public"."buses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mantenciones" ADD CONSTRAINT "mantenciones_plan_id_planes_mantencion_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."planes_mantencion"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mantenciones" ADD CONSTRAINT "mantenciones_bus_id_buses_id_fk" FOREIGN KEY ("bus_id") REFERENCES "public"."buses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planes_mantencion" ADD CONSTRAINT "planes_mantencion_bus_id_buses_id_fk" FOREIGN KEY ("bus_id") REFERENCES "public"."buses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "documentos_control_vencimiento_idx" ON "documentos_control" USING btree ("fecha_vencimiento") WHERE "documentos_control"."eliminado_en" is null;--> statement-breakpoint
CREATE INDEX "lecturas_kilometraje_bus_fecha_idx" ON "lecturas_kilometraje" USING btree ("bus_id","fecha","id");--> statement-breakpoint
CREATE INDEX "mantenciones_bus_fecha_idx" ON "mantenciones" USING btree ("bus_id","fecha");--> statement-breakpoint
ALTER TABLE "conductores" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "documentos_control" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "lecturas_kilometraje" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "planes_mantencion" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "mantenciones" ENABLE ROW LEVEL SECURITY;
