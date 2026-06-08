CREATE TYPE "public"."appt_status" AS ENUM('scheduled', 'completed', 'cancelled', 'no_show');--> statement-breakpoint
CREATE TYPE "public"."import_method" AS ENUM('zapier_csv', 'porter_api', 'manual');--> statement-breakpoint
CREATE TYPE "public"."incident_type" AS ENUM('equipment_failure', 'customer_issue', 'staffing', 'supply_shortage', 'quality_concern', 'operational');--> statement-breakpoint
CREATE TYPE "public"."qb_sync_status" AS ENUM('pending', 'synced', 'failed', 'manual');--> statement-breakpoint
CREATE TYPE "public"."referral_source" AS ENUM('walk_in', 'referral_customer', 'instagram', 'previous', 'other');--> statement-breakpoint
CREATE TYPE "public"."service_type" AS ENUM('tattoo', 'piercing', 'laser', 'other');--> statement-breakpoint
CREATE TYPE "public"."task_priority" AS ENUM('critical', 'high', 'normal', 'backlog');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('open', 'in_progress', 'completed');--> statement-breakpoint
CREATE TYPE "public"."task_type" AS ENUM('expense', 'incident', 'admin', 'follow_up', 'staff_note');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('OWNER', 'MANAGER', 'FRONT_DESK', 'ARTIST');--> statement-breakpoint
CREATE TABLE "appointment_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"appointment_id" uuid NOT NULL,
	"artist_id" uuid NOT NULL,
	"customer_id" uuid,
	"service_type" "service_type" NOT NULL,
	"deposit_amount" numeric(10, 2) DEFAULT '0',
	"final_amount" numeric(10, 2) DEFAULT '0',
	"tip_amount" numeric(10, 2) DEFAULT '0',
	"total_revenue" numeric(10, 2) NOT NULL,
	"estimated_cost" numeric(10, 2),
	"actual_cost" numeric(10, 2),
	"commission_percentage" numeric(5, 4) NOT NULL,
	"artist_payout" numeric(10, 2) NOT NULL,
	"payment_method" varchar(20),
	"payment_date" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"porter_appointment_id" varchar,
	"customer_id" uuid,
	"artist_id" uuid,
	"service_type" "service_type" NOT NULL,
	"status" "appt_status" DEFAULT 'scheduled' NOT NULL,
	"appointment_date" timestamp NOT NULL,
	"completed_date" timestamp,
	"deposit_collected" boolean DEFAULT false,
	"referral_source" "referral_source",
	"greeted_by_user_id" uuid,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "appointments_porter_appointment_id_unique" UNIQUE("porter_appointment_id")
);
--> statement-breakpoint
CREATE TABLE "artists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"porter_artist_id" varchar,
	"name" text NOT NULL,
	"commission_percentage" numeric(5, 4) NOT NULL,
	"specialties" jsonb DEFAULT '[]'::jsonb,
	"is_active" boolean DEFAULT true,
	"portfolio_url" text,
	"bio" text,
	"last_portfolio_update" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "artists_porter_artist_id_unique" UNIQUE("porter_artist_id")
);
--> statement-breakpoint
CREATE TABLE "brain_dumps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_user_id" uuid,
	"raw_input" text NOT NULL,
	"input_type" varchar(10) DEFAULT 'text',
	"receipt_urls" jsonb DEFAULT '[]'::jsonb,
	"parse_result" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "briefings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"briefing_type" varchar(10) NOT NULL,
	"generated_at" timestamp DEFAULT now(),
	"period_start" timestamp,
	"period_end" timestamp,
	"data_snapshot" jsonb,
	"narrative" text,
	"delivered_via" varchar(20),
	"delivered_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "commissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artist_id" uuid NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"service_revenue" numeric(12, 2) NOT NULL,
	"commission_earned" numeric(12, 2) NOT NULL,
	"walk_in_bonus" numeric(10, 2) DEFAULT '0',
	"referral_bonus" numeric(10, 2) DEFAULT '0',
	"total_owed" numeric(12, 2) NOT NULL,
	"paid_amount" numeric(12, 2) DEFAULT '0',
	"scheduled_payout_date" timestamp,
	"status" varchar(20) DEFAULT 'pending',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"porter_client_id" varchar,
	"name" text NOT NULL,
	"email" varchar,
	"phone" varchar,
	"preferred_artist_id" uuid,
	"referred_by_customer_id" uuid,
	"total_spent" numeric(12, 2) DEFAULT '0',
	"appointment_count" integer DEFAULT 0,
	"first_appointment_date" timestamp,
	"last_appointment_date" timestamp,
	"typical_gap_days" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "customers_porter_client_id_unique" UNIQUE("porter_client_id")
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"logged_by_user_id" uuid,
	"description" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"category" varchar(30) NOT NULL,
	"qb_gl_account" varchar(20),
	"qb_sync_status" "qb_sync_status" DEFAULT 'pending',
	"receipt_url" text,
	"inventory_sku" varchar(50),
	"inventory_qty" integer,
	"ai_confidence" numeric(3, 2),
	"needs_review" boolean DEFAULT false,
	"expense_date" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"logged_by_user_id" uuid,
	"incident_type" "incident_type" NOT NULL,
	"description" text NOT NULL,
	"priority" "task_priority" DEFAULT 'normal',
	"status" "task_status" DEFAULT 'open',
	"resolution" text,
	"resolved_date" timestamp,
	"occurred_date" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "inventory_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sku" varchar(50) NOT NULL,
	"name" text NOT NULL,
	"category" varchar(30),
	"current_qty" integer DEFAULT 0,
	"reorder_threshold" integer DEFAULT 0,
	"unit_cost" numeric(10, 2),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "inventory_items_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
CREATE TABLE "inventory_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"delta" integer NOT NULL,
	"reason" varchar(50),
	"linked_expense_id" uuid,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "message_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"channel" varchar(10),
	"body" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid,
	"channel" varchar(10),
	"body" text NOT NULL,
	"sent_by_user_id" uuid,
	"sent_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "meta" (
	"id" serial PRIMARY KEY NOT NULL,
	"last_porter_import" timestamp,
	"last_briefing_sent" timestamp,
	"last_qb_sync" timestamp,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "nudges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"reason" varchar(30) DEFAULT 'friendly_reconnect',
	"message" text,
	"channel" varchar(10),
	"sent_at" timestamp,
	"resonated" boolean,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "porter_import_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"import_date" timestamp DEFAULT now(),
	"record_count" integer DEFAULT 0,
	"source_method" "import_method" NOT NULL,
	"status" varchar(20) DEFAULT 'success',
	"errors" jsonb DEFAULT '[]'::jsonb
);
--> statement-breakpoint
CREATE TABLE "qb_sync_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expense_id" uuid,
	"payload" jsonb NOT NULL,
	"attempts" integer DEFAULT 0,
	"last_error" text,
	"status" "qb_sync_status" DEFAULT 'pending',
	"next_retry_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" varchar(100) NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "sop_checklist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sop_id" uuid NOT NULL,
	"label" text NOT NULL,
	"sort_order" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "sops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"role" "user_role",
	"frequency" varchar(20),
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "strategic_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_user_id" uuid,
	"content" text NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brain_dump_id" uuid,
	"proposed_type" "task_type" NOT NULL,
	"raw_text" text NOT NULL,
	"parsed_payload" jsonb,
	"ai_confidence" numeric(3, 2),
	"status" varchar(20) DEFAULT 'pending',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "task_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "task_type" NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"linked_record_id" uuid,
	"linked_record_type" varchar(30),
	"status" "task_status" DEFAULT 'open',
	"priority" "task_priority" DEFAULT 'normal',
	"due_date" timestamp,
	"completed_date" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar NOT NULL,
	"password_hash" varchar NOT NULL,
	"first_name" varchar NOT NULL,
	"last_name" varchar NOT NULL,
	"role" "user_role" DEFAULT 'FRONT_DESK' NOT NULL,
	"phone" varchar,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "appointment_payments" ADD CONSTRAINT "appointment_payments_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_payments" ADD CONSTRAINT "appointment_payments_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_payments" ADD CONSTRAINT "appointment_payments_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_greeted_by_user_id_users_id_fk" FOREIGN KEY ("greeted_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artists" ADD CONSTRAINT "artists_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brain_dumps" ADD CONSTRAINT "brain_dumps_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_preferred_artist_id_artists_id_fk" FOREIGN KEY ("preferred_artist_id") REFERENCES "public"."artists"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_logged_by_user_id_users_id_fk" FOREIGN KEY ("logged_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_logged_by_user_id_users_id_fk" FOREIGN KEY ("logged_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sent_by_user_id_users_id_fk" FOREIGN KEY ("sent_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nudges" ADD CONSTRAINT "nudges_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qb_sync_queue" ADD CONSTRAINT "qb_sync_queue_expense_id_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expenses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sop_checklist_items" ADD CONSTRAINT "sop_checklist_items_sop_id_sops_id_fk" FOREIGN KEY ("sop_id") REFERENCES "public"."sops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategic_notes" ADD CONSTRAINT "strategic_notes_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pay_artist_date_idx" ON "appointment_payments" USING btree ("artist_id","payment_date");--> statement-breakpoint
CREATE INDEX "pay_service_idx" ON "appointment_payments" USING btree ("service_type");--> statement-breakpoint
CREATE INDEX "appts_porter_idx" ON "appointments" USING btree ("porter_appointment_id");--> statement-breakpoint
CREATE INDEX "appts_artist_date_idx" ON "appointments" USING btree ("artist_id","completed_date");--> statement-breakpoint
CREATE INDEX "appts_customer_idx" ON "appointments" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "artists_porter_idx" ON "artists" USING btree ("porter_artist_id");--> statement-breakpoint
CREATE INDEX "comm_artist_period_idx" ON "commissions" USING btree ("artist_id","period_start");--> statement-breakpoint
CREATE INDEX "customers_porter_idx" ON "customers" USING btree ("porter_client_id");--> statement-breakpoint
CREATE INDEX "customers_last_appt_idx" ON "customers" USING btree ("last_appointment_date");--> statement-breakpoint
CREATE INDEX "nudges_customer_idx" ON "nudges" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "notes_created_idx" ON "strategic_notes" USING btree ("created_at");