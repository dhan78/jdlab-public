CREATE TABLE "contact_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" text DEFAULT 'contact' NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"service" text,
	"message" text,
	"practice_name" text,
	"scanner_brand" text,
	"monthly_volume" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "contact_requests_created_idx" ON "contact_requests" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "contact_requests_source_idx" ON "contact_requests" USING btree ("source");
