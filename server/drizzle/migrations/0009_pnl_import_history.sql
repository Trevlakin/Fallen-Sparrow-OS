CREATE TABLE "pnl_import_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"import_type" varchar(20) NOT NULL,
	"file_name" text NOT NULL,
	"row_count" integer NOT NULL,
	"skipped_count" integer DEFAULT 0 NOT NULL,
	"imported_by_user_id" uuid NOT NULL,
	"summary_stats" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pnl_import_history" ADD CONSTRAINT "pnl_import_history_imported_by_user_id_users_id_fk" FOREIGN KEY ("imported_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "pnl_import_history_created_idx" ON "pnl_import_history" USING btree ("created_at");
