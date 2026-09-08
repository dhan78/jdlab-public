ALTER TABLE "case_messages" ADD COLUMN "kind" text DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE "case_messages" ADD COLUMN "meta" text;
