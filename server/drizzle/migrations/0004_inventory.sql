ALTER TABLE "inventory_items" DROP CONSTRAINT IF EXISTS "inventory_items_sku_unique";--> statement-breakpoint
ALTER TABLE "inventory_items" DROP COLUMN IF EXISTS "sku";--> statement-breakpoint
ALTER TABLE "inventory_items" DROP COLUMN IF EXISTS "unit_cost";--> statement-breakpoint
ALTER TABLE "inventory_items" RENAME COLUMN "current_qty" TO "current_stock";--> statement-breakpoint
ALTER TABLE "inventory_items" ADD COLUMN "unit" varchar(50) DEFAULT 'unit' NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_items" ALTER COLUMN "unit" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD COLUMN "ideal_stock" integer;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD COLUMN "notes" varchar(500);--> statement-breakpoint
ALTER TABLE "inventory_items" ADD COLUMN "is_active" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD COLUMN "created_at" timestamp DEFAULT now();--> statement-breakpoint
UPDATE "inventory_items" SET "category" = 'other' WHERE "category" IS NULL;--> statement-breakpoint
ALTER TABLE "inventory_items" ALTER COLUMN "category" SET DEFAULT 'other';--> statement-breakpoint
ALTER TABLE "inventory_items" ALTER COLUMN "category" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_items" ALTER COLUMN "reorder_threshold" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "inventory_transactions" DROP COLUMN IF EXISTS "delta";--> statement-breakpoint
ALTER TABLE "inventory_transactions" DROP COLUMN IF EXISTS "reason";--> statement-breakpoint
ALTER TABLE "inventory_transactions" DROP COLUMN IF EXISTS "linked_expense_id";--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD COLUMN "type" varchar(20);--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD COLUMN "quantity" integer;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD COLUMN "previous_stock" integer;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD COLUMN "new_stock" integer;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD COLUMN "notes" varchar(500);--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
