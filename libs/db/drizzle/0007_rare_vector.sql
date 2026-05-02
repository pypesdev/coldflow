CREATE TYPE "public"."reply_followup_status" AS ENUM('scheduled', 'sent', 'cancelled');--> statement-breakpoint
CREATE TABLE "reply_followup" (
	"id" text PRIMARY KEY NOT NULL,
	"sequence_id" text NOT NULL,
	"contact_id" text NOT NULL,
	"recipient_email" text NOT NULL,
	"last_reply_at" timestamp NOT NULL,
	"last_reply_excerpt" text,
	"scheduled_send_at" timestamp NOT NULL,
	"status" "reply_followup_status" DEFAULT 'scheduled' NOT NULL,
	"template_id" text,
	"sent_queue_id" text,
	"cancel_reason" text,
	"sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reply_followup" ADD CONSTRAINT "reply_followup_sequence_id_email_campaign_id_fk" FOREIGN KEY ("sequence_id") REFERENCES "public"."email_campaign"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reply_followup" ADD CONSTRAINT "reply_followup_contact_id_email_queue_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."email_queue"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reply_followup" ADD CONSTRAINT "reply_followup_template_id_email_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."email_template"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reply_followup" ADD CONSTRAINT "reply_followup_sent_queue_id_email_queue_id_fk" FOREIGN KEY ("sent_queue_id") REFERENCES "public"."email_queue"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reply_followup_sequenceId_idx" ON "reply_followup" USING btree ("sequence_id");--> statement-breakpoint
CREATE INDEX "reply_followup_contactId_idx" ON "reply_followup" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "reply_followup_status_idx" ON "reply_followup" USING btree ("status");--> statement-breakpoint
CREATE INDEX "reply_followup_scheduledSendAt_idx" ON "reply_followup" USING btree ("scheduled_send_at");--> statement-breakpoint
CREATE INDEX "reply_followup_status_scheduledSendAt_idx" ON "reply_followup" USING btree ("status","scheduled_send_at");