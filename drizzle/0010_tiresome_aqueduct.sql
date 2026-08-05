ALTER TABLE "case_annotations" ADD COLUMN "kind" text DEFAULT 'pin' NOT NULL;--> statement-breakpoint
ALTER TABLE "case_annotations" ADD COLUMN "bx" double precision;--> statement-breakpoint
ALTER TABLE "case_annotations" ADD COLUMN "by" double precision;--> statement-breakpoint
ALTER TABLE "case_annotations" ADD COLUMN "bz" double precision;
