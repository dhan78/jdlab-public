ALTER TABLE "case_annotations" ALTER COLUMN "attachment_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "case_annotations" ADD COLUMN "preview_key" text;
