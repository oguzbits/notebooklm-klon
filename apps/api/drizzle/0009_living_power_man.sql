ALTER TABLE "studio_outputs" ADD COLUMN "request" jsonb;--> statement-breakpoint
ALTER TABLE "studio_outputs" ADD COLUMN "unread" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "studio_outputs" ADD COLUMN "feedback" text;