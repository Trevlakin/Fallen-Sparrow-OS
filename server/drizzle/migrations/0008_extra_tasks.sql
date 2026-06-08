CREATE TABLE "extra_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"description" text NOT NULL,
	"team_member_id" uuid,
	"logged_by_label" varchar(100),
	"status" varchar(20) DEFAULT 'open' NOT NULL,
	"logged_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"session_date" date NOT NULL,
	"notes" text
);
--> statement-breakpoint
ALTER TABLE "extra_tasks" ADD CONSTRAINT "extra_tasks_team_member_id_team_members_id_fk" FOREIGN KEY ("team_member_id") REFERENCES "public"."team_members"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "extra_tasks_session_date_idx" ON "extra_tasks" USING btree ("session_date");
--> statement-breakpoint
CREATE INDEX "extra_tasks_status_idx" ON "extra_tasks" USING btree ("status");
