CREATE TABLE "jarvis_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_user_id" uuid NOT NULL,
	"raw_input" text NOT NULL,
	"intent" varchar(10) NOT NULL,
	"input_type" varchar(10) DEFAULT 'text' NOT NULL,
	"response_preview" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "jarvis_requests" ADD CONSTRAINT "jarvis_requests_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "jarvis_requests_author_created_idx" ON "jarvis_requests" USING btree ("author_user_id","created_at");
