CREATE TYPE "public"."note_kind" AS ENUM('ANSWER', 'WRITTEN');--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "kind" "note_kind" DEFAULT 'ANSWER' NOT NULL;--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "body" text;