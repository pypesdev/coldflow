CREATE TYPE "public"."reply_intent" AS ENUM('interested', 'objection', 'not_now', 'out_of_office');--> statement-breakpoint
CREATE TYPE "public"."reply_triage_status" AS ENUM('new', 'actioned', 'archived');--> statement-breakpoint
CREATE TABLE "reply" (
	"id" text PRIMARY KEY NOT NULL,
	"contact_id" text NOT NULL,
	"campaign_id" text NOT NULL,
	"event_id" text,
	"recipient_email" text NOT NULL,
	"recipient_name" text,
	"body" text NOT NULL,
	"intent" "reply_intent" NOT NULL,
	"confidence" real NOT NULL,
	"suggested_followup" text NOT NULL,
	"status" "reply_triage_status" DEFAULT 'new' NOT NULL,
	"sent_queue_id" text,
	"actioned_at" timestamp,
	"archived_at" timestamp,
	"received_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reply" ADD CONSTRAINT "reply_contact_id_email_queue_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."email_queue"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reply" ADD CONSTRAINT "reply_campaign_id_email_campaign_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."email_campaign"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reply" ADD CONSTRAINT "reply_event_id_email_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."email_event"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reply" ADD CONSTRAINT "reply_sent_queue_id_email_queue_id_fk" FOREIGN KEY ("sent_queue_id") REFERENCES "public"."email_queue"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reply_contactId_idx" ON "reply" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "reply_campaignId_idx" ON "reply" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "reply_status_idx" ON "reply" USING btree ("status");--> statement-breakpoint
CREATE INDEX "reply_intent_idx" ON "reply" USING btree ("intent");--> statement-breakpoint
CREATE INDEX "reply_status_intent_idx" ON "reply" USING btree ("status","intent");--> statement-breakpoint
CREATE INDEX "reply_receivedAt_idx" ON "reply" USING btree ("received_at");