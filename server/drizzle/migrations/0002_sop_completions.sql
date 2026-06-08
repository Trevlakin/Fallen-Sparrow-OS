CREATE TABLE "sop_completions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"completed_by_user_id" uuid,
	"completed_by_label" varchar,
	"completed_at" timestamp DEFAULT now(),
	"session_date" date NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sop_completions" ADD CONSTRAINT "sop_completions_item_id_sop_checklist_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."sop_checklist_items"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sop_completions" ADD CONSTRAINT "sop_completions_completed_by_user_id_users_id_fk" FOREIGN KEY ("completed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "sop_completions_item_session_idx" ON "sop_completions" USING btree ("item_id","session_date");
--> statement-breakpoint
CREATE UNIQUE INDEX "sop_completions_item_session_unique" ON "sop_completions" USING btree ("item_id","session_date");
--> statement-breakpoint
CREATE TABLE "checklist_access" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" varchar NOT NULL,
	"access_token" varchar NOT NULL,
	"pin" varchar(4),
	"sop_id" uuid NOT NULL,
	"is_active" boolean DEFAULT true,
	"last_used_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "checklist_access_access_token_unique" UNIQUE("access_token")
);
--> statement-breakpoint
ALTER TABLE "checklist_access" ADD CONSTRAINT "checklist_access_sop_id_sops_id_fk" FOREIGN KEY ("sop_id") REFERENCES "public"."sops"("id") ON DELETE no action ON UPDATE no action;
