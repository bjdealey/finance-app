ALTER TABLE "recommendations" ADD COLUMN "key" text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "recs_user_key_uniq" ON "recommendations" USING btree ("user_id","key");