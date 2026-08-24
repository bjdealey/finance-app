CREATE TYPE "public"."access_type" AS ENUM('INSTANT', 'NOTICE', 'FIXED_TERM', 'RESTRICTED', 'UNKNOWN');--> statement-breakpoint
CREATE TYPE "public"."account_type" AS ENUM('CURRENT', 'SAVINGS', 'CREDIT_CARD', 'CASH_ISA', 'INVESTMENT', 'LOAN', 'MORTGAGE');--> statement-breakpoint
CREATE TYPE "public"."category_kind" AS ENUM('INCOME', 'EXPENSE', 'TRANSFER', 'NEUTRAL');--> statement-breakpoint
CREATE TYPE "public"."rec_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED', 'SNOOZED');--> statement-breakpoint
CREATE TYPE "public"."rec_type" AS ENUM('MOVE_CASH', 'REDUCE_SPEND', 'KEEP_BUFFER', 'PAY_DEBT', 'GOAL_CONTRIBUTION');--> statement-breakpoint
CREATE TYPE "public"."rule_match_type" AS ENUM('MERCHANT_EXACT', 'KEYWORD', 'REGEX');--> statement-breakpoint
CREATE TYPE "public"."rule_source" AS ENUM('SEED', 'USER_CORRECTION');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('INCOME', 'EXPENSE', 'TRANSFER', 'REFUND', 'INTEREST', 'FEE', 'CARD_PAYMENT', 'UNKNOWN');--> statement-breakpoint
CREATE TYPE "public"."txn_source" AS ENUM('SEED', 'CSV', 'MANUAL');--> statement-breakpoint
CREATE TYPE "public"."txn_status" AS ENUM('POSTED', 'PENDING', 'REVERSED');--> statement-breakpoint
CREATE TYPE "public"."user_rule_type" AS ENUM('MIN_CURRENT_BALANCE', 'EMERGENCY_MONTHS', 'NO_INVEST_WITHIN_MONTHS', 'PRIORITISE_GOAL', 'DO_NOT_TOUCH_ACCOUNT', 'PREFER_INSTANT_ACCESS');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"institution" text,
	"account_type" "account_type" NOT NULL,
	"currency" text DEFAULT 'GBP' NOT NULL,
	"opening_balance" bigint DEFAULT 0 NOT NULL,
	"opening_balance_date" date NOT NULL,
	"interest_rate_bps" integer DEFAULT 0 NOT NULL,
	"access_type" "access_type" DEFAULT 'UNKNOWN' NOT NULL,
	"tax_wrapper" text,
	"purpose" text,
	"credit_limit" bigint,
	"minimum_payment" bigint,
	"payment_due_day" integer,
	"statement_day" integer,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"parent_id" uuid,
	"kind" "category_kind" DEFAULT 'EXPENSE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "category_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"match_type" "rule_match_type" NOT NULL,
	"pattern" text NOT NULL,
	"category_id" uuid NOT NULL,
	"priority" integer DEFAULT 100 NOT NULL,
	"source" "rule_source" DEFAULT 'SEED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"target_amount" bigint NOT NULL,
	"target_date" date,
	"linked_account_id" uuid,
	"current_amount" bigint DEFAULT 0 NOT NULL,
	"priority" integer DEFAULT 100 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"filename" text NOT NULL,
	"row_count" integer DEFAULT 0 NOT NULL,
	"imported_count" integer DEFAULT 0 NOT NULL,
	"duplicate_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "rec_type" NOT NULL,
	"priority" integer DEFAULT 100 NOT NULL,
	"source_account_id" uuid,
	"destination_account_id" uuid,
	"amount" bigint,
	"reason_codes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"constraints_checked" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"expected_benefit" jsonb,
	"confidence" integer DEFAULT 0 NOT NULL,
	"impact" jsonb,
	"explanation_trace" jsonb,
	"status" "rec_status" DEFAULT 'PENDING' NOT NULL,
	"snooze_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"date" date NOT NULL,
	"amount" bigint NOT NULL,
	"currency" text DEFAULT 'GBP' NOT NULL,
	"merchant" text,
	"description" text,
	"category_id" uuid,
	"transaction_type" "transaction_type" DEFAULT 'UNKNOWN' NOT NULL,
	"status" "txn_status" DEFAULT 'POSTED' NOT NULL,
	"transfer_group_id" uuid,
	"recurring_series_id" text,
	"confidence" integer DEFAULT 0 NOT NULL,
	"source" "txn_source" DEFAULT 'MANUAL' NOT NULL,
	"import_batch_id" uuid,
	"dedupe_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"rule_type" "user_rule_type" NOT NULL,
	"params" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"base_currency" text DEFAULT 'GBP' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_rules" ADD CONSTRAINT "category_rules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_rules" ADD CONSTRAINT "category_rules_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_linked_account_id_accounts_id_fk" FOREIGN KEY ("linked_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_source_account_id_accounts_id_fk" FOREIGN KEY ("source_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_destination_account_id_accounts_id_fk" FOREIGN KEY ("destination_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_import_batch_id_import_batches_id_fk" FOREIGN KEY ("import_batch_id") REFERENCES "public"."import_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_rules" ADD CONSTRAINT "user_rules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_user_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "categories_user_idx" ON "categories" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "category_rules_user_idx" ON "category_rules" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "goals_user_idx" ON "goals" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "recs_user_idx" ON "recommendations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "txn_user_date_idx" ON "transactions" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "txn_account_idx" ON "transactions" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "txn_transfer_group_idx" ON "transactions" USING btree ("transfer_group_id");--> statement-breakpoint
CREATE INDEX "txn_dedupe_idx" ON "transactions" USING btree ("account_id","dedupe_key");--> statement-breakpoint
CREATE INDEX "user_rules_user_idx" ON "user_rules" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uniq" ON "users" USING btree ("email");