CREATE TYPE "public"."usage_purpose" AS ENUM('CHAT_QUESTION', 'STUDIO_OUTPUT', 'OVERVIEW_SUMMARY', 'SOURCE_READING', 'SOURCE_EMBEDDING');--> statement-breakpoint
CREATE TYPE "public"."usage_role" AS ENUM('DOCUMENT_READER', 'ANSWER_WRITER', 'TEXT_EMBEDDER');--> statement-breakpoint
CREATE TABLE "usage_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"purpose" "usage_purpose" NOT NULL,
	"role" "usage_role" NOT NULL,
	"input_tokens" integer NOT NULL,
	"output_tokens" integer NOT NULL,
	"estimated" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "usage_events_user_idx" ON "usage_events" USING btree ("user_id","created_at");