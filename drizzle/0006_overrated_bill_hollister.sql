CREATE TABLE "sla_config" (
	"case_type" text PRIMARY KEY NOT NULL,
	"standard_days" integer NOT NULL,
	"rush_days" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
