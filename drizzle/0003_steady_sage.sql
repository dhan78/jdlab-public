CREATE TABLE "case_reads" (
	"user_id" integer NOT NULL,
	"case_id" integer NOT NULL,
	"last_read_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "case_reads_user_id_case_id_pk" PRIMARY KEY("user_id","case_id")
);
--> statement-breakpoint
ALTER TABLE "case_reads" ADD CONSTRAINT "case_reads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_reads" ADD CONSTRAINT "case_reads_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;
