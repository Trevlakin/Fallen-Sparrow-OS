CREATE TABLE "pin_change_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_member_id" uuid NOT NULL,
	"changed_by_user_id" uuid NOT NULL,
	"changed_at" timestamp DEFAULT now() NOT NULL,
	"change_reason" varchar(200)
);
--> statement-breakpoint
ALTER TABLE "pin_change_history" ADD CONSTRAINT "pin_change_history_team_member_id_team_members_id_fk" FOREIGN KEY ("team_member_id") REFERENCES "public"."team_members"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "pin_change_history" ADD CONSTRAINT "pin_change_history_changed_by_user_id_users_id_fk" FOREIGN KEY ("changed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "pin_change_history_member_idx" ON "pin_change_history" USING btree ("team_member_id");
--> statement-breakpoint
CREATE INDEX "pin_change_history_changed_at_idx" ON "pin_change_history" USING btree ("changed_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sop_completions_session_date_idx" ON "sop_completions" USING btree ("session_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sop_completions_member_session_idx" ON "sop_completions" USING btree ("team_member_id","session_date");
