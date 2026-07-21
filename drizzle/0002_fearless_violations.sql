CREATE TABLE "practice_addresses" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"label" text,
	"address" text NOT NULL,
	"is_preferred" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "ship_to_address" text;--> statement-breakpoint
ALTER TABLE "practice_addresses" ADD CONSTRAINT "practice_addresses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "practice_addresses_user_idx" ON "practice_addresses" USING btree ("user_id");--> statement-breakpoint
INSERT INTO "practice_addresses" ("user_id", "address", "is_preferred")
SELECT "id", "practice_address", true
FROM "users"
WHERE "practice_address" IS NOT NULL AND btrim("practice_address") <> '';
