CREATE TYPE "public"."studio_kind" AS ENUM('REPORT', 'FLASHCARDS', 'QUIZ', 'MINDMAP');--> statement-breakpoint
CREATE TABLE "studio_outputs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"notebook_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"kind" "studio_kind" NOT NULL,
	"format" text,
	"title" text NOT NULL,
	"content" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notebooks" ADD COLUMN "chat_config" jsonb;--> statement-breakpoint
ALTER TABLE "studio_outputs" ADD CONSTRAINT "studio_outputs_notebook_id_notebooks_id_fk" FOREIGN KEY ("notebook_id") REFERENCES "public"."notebooks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "studio_outputs" ADD CONSTRAINT "studio_outputs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "studio_outputs_notebook_idx" ON "studio_outputs" USING btree ("notebook_id","created_at");