CREATE TABLE "manufacturing_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"case_id" integer NOT NULL,
	"attachment_id" integer,
	"storage_key" text NOT NULL,
	"file_name" text NOT NULL,
	"machine" text,
	"status" text DEFAULT 'queued' NOT NULL,
	"detail" text,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "manufacturing_jobs" ADD CONSTRAINT "manufacturing_jobs_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manufacturing_jobs" ADD CONSTRAINT "manufacturing_jobs_attachment_id_message_attachments_id_fk" FOREIGN KEY ("attachment_id") REFERENCES "public"."message_attachments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manufacturing_jobs" ADD CONSTRAINT "manufacturing_jobs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "manufacturing_jobs_status_idx" ON "manufacturing_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "manufacturing_jobs_case_idx" ON "manufacturing_jobs" USING btree ("case_id");
