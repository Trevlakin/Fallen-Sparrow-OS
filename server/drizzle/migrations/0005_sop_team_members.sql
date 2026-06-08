CREATE TABLE "team_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"display_name" varchar(255) NOT NULL,
	"role" varchar(50) NOT NULL,
	"pin" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sop_role_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sop_id" uuid NOT NULL,
	"role" varchar(50) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sop_role_assignments" ADD CONSTRAINT "sop_role_assignments_sop_id_sops_id_fk" FOREIGN KEY ("sop_id") REFERENCES "public"."sops"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "sop_role_assignments_sop_role_unique" ON "sop_role_assignments" USING btree ("sop_id","role");
--> statement-breakpoint
INSERT INTO "sop_role_assignments" ("sop_id", "role")
SELECT "id", "role"::text FROM "sops" WHERE "role" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "sops" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "sops" ADD COLUMN "updated_at" timestamp DEFAULT now();
--> statement-breakpoint
ALTER TABLE "sop_checklist_items" ADD COLUMN "is_active" boolean DEFAULT true;
--> statement-breakpoint
ALTER TABLE "sop_checklist_items" ADD COLUMN "created_at" timestamp DEFAULT now();
--> statement-breakpoint
ALTER TABLE "sop_completions" ADD COLUMN "team_member_id" uuid;
--> statement-breakpoint
ALTER TABLE "sop_completions" ADD CONSTRAINT "sop_completions_team_member_id_team_members_id_fk" FOREIGN KEY ("team_member_id") REFERENCES "public"."team_members"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
DROP INDEX IF EXISTS "sop_completions_item_session_unique";
--> statement-breakpoint
CREATE UNIQUE INDEX "sop_completions_item_member_session_unique" ON "sop_completions" USING btree ("item_id","team_member_id","session_date") WHERE "team_member_id" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "sop_completions_item_session_legacy_unique" ON "sop_completions" USING btree ("item_id","session_date") WHERE "team_member_id" IS NULL;
