CREATE TABLE "contratos" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "contratos_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"cliente_id" integer NOT NULL,
	"servicio_id" integer NOT NULL,
	"documento_id" integer,
	"titulo" text NOT NULL,
	"detalle" text NOT NULL,
	"fecha_inicio" date NOT NULL,
	"fecha_vencimiento" date NOT NULL,
	"monto" integer NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contratos_fechas" CHECK ("contratos"."fecha_inicio" <= "contratos"."fecha_vencimiento")
);
--> statement-breakpoint
CREATE TABLE "cotizaciones" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "cotizaciones_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"cliente_id" integer NOT NULL,
	"servicio_id" integer NOT NULL,
	"detalle" text NOT NULL,
	"fecha_solicitud" date NOT NULL,
	"fecha_servicio" date NOT NULL,
	"monto" integer NOT NULL,
	"estado" text DEFAULT 'pendiente' NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "viajes" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "viajes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"cotizacion_id" integer,
	"cliente_id" integer NOT NULL,
	"servicio_id" integer NOT NULL,
	"bus_id" integer,
	"conductor_id" integer,
	"fecha" date NOT NULL,
	"detalle" text NOT NULL,
	"monto" integer NOT NULL,
	"documentacion_lista" boolean DEFAULT false NOT NULL,
	"estado" text DEFAULT 'programado' NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "viajes_cotizacionId_unique" UNIQUE("cotizacion_id")
);
--> statement-breakpoint
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_cliente_id_personas_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."personas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_servicio_id_servicios_id_fk" FOREIGN KEY ("servicio_id") REFERENCES "public"."servicios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_documento_id_documentos_id_fk" FOREIGN KEY ("documento_id") REFERENCES "public"."documentos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cotizaciones" ADD CONSTRAINT "cotizaciones_cliente_id_personas_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."personas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cotizaciones" ADD CONSTRAINT "cotizaciones_servicio_id_servicios_id_fk" FOREIGN KEY ("servicio_id") REFERENCES "public"."servicios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viajes" ADD CONSTRAINT "viajes_cotizacion_id_cotizaciones_id_fk" FOREIGN KEY ("cotizacion_id") REFERENCES "public"."cotizaciones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viajes" ADD CONSTRAINT "viajes_cliente_id_personas_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."personas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viajes" ADD CONSTRAINT "viajes_servicio_id_servicios_id_fk" FOREIGN KEY ("servicio_id") REFERENCES "public"."servicios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viajes" ADD CONSTRAINT "viajes_bus_id_buses_id_fk" FOREIGN KEY ("bus_id") REFERENCES "public"."buses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viajes" ADD CONSTRAINT "viajes_conductor_id_conductores_id_fk" FOREIGN KEY ("conductor_id") REFERENCES "public"."conductores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contratos_vencimiento_idx" ON "contratos" USING btree ("fecha_vencimiento");--> statement-breakpoint
CREATE INDEX "cotizaciones_estado_fecha_idx" ON "cotizaciones" USING btree ("estado","fecha_servicio");--> statement-breakpoint
CREATE INDEX "viajes_estado_fecha_idx" ON "viajes" USING btree ("estado","fecha");--> statement-breakpoint
ALTER TABLE "contratos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "cotizaciones" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "viajes" ENABLE ROW LEVEL SECURITY;
