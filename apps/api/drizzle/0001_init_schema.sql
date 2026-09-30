CREATE TYPE "public"."source_kind" AS ENUM('PDF', 'DOCX', 'TXT', 'MD', 'URL');--> statement-breakpoint
CREATE TYPE "public"."source_status" AS ENUM('PENDING', 'PROCESSING', 'READY', 'FAILED');--> statement-breakpoint
CREATE TABLE "chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"ordinal" integer NOT NULL,
	"text" text NOT NULL,
	"start_offset" integer NOT NULL,
	"end_offset" integer NOT NULL,
	"token_count" integer,
	"embedding" vector(768),
	"search_vector" "tsvector" GENERATED ALWAYS AS (to_tsvector('simple', "chunks"."text")) STORED,
	CONSTRAINT "chunks_source_ordinal_unique" UNIQUE("source_id","ordinal")
);
--> statement-breakpoint
CREATE TABLE "notebook_sources" (
	"notebook_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"selected" boolean DEFAULT true NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notebook_sources_notebook_id_source_id_pk" PRIMARY KEY("notebook_id","source_id")
);
--> statement-breakpoint
CREATE TABLE "notebooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"content_hash" text NOT NULL,
	"kind" "source_kind" NOT NULL,
	"title" text NOT NULL,
	"source_url" text,
	"status" "source_status" DEFAULT 'PENDING' NOT NULL,
	"error_message" text,
	"canonical_text" text,
	"page_count" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sources_user_content_hash_unique" UNIQUE("user_id","content_hash")
);
--> statement-breakpoint
ALTER TABLE "chunks" ADD CONSTRAINT "chunks_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notebook_sources" ADD CONSTRAINT "notebook_sources_notebook_id_notebooks_id_fk" FOREIGN KEY ("notebook_id") REFERENCES "public"."notebooks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notebook_sources" ADD CONSTRAINT "notebook_sources_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chunks_embedding_hnsw_idx" ON "chunks" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "chunks_search_vector_gin_idx" ON "chunks" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "notebook_sources_source_id_idx" ON "notebook_sources" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "notebooks_user_id_idx" ON "notebooks" USING btree ("user_id");