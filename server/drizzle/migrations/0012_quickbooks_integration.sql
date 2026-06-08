ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "quickbooks_id" varchar(50);--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "source" varchar(20) DEFAULT 'manual';--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now();--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "expenses_quickbooks_id_idx" ON "expenses" USING btree ("quickbooks_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "expenses_source_idx" ON "expenses" USING btree ("source");
