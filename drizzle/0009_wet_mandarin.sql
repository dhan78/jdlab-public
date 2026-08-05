CREATE TABLE "case_annotations" (
	"id" serial PRIMARY KEY NOT NULL,
	"case_id" integer NOT NULL,
	"attachment_id" integer NOT NULL,
	"x" double precision NOT NULL,
	"y" double precision NOT NULL,
	"z" double precision NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"author_id" integer,
	"author_name" text NOT NULL,
	"author_role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "case_annotations" ADD CONSTRAINT "case_annotations_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_annotations" ADD CONSTRAINT "case_annotations_attachment_id_message_attachments_id_fk" FOREIGN KEY ("attachment_id") REFERENCES "public"."message_attachments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_annotations" ADD CONSTRAINT "case_annotations_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "case_annotations_case_idx" ON "case_annotations" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "case_annotations_attachment_idx" ON "case_annotations" USING btree ("attachment_id");
