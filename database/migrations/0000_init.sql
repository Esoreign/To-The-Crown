CREATE TABLE "active_events" (
	"game_id" uuid NOT NULL,
	"id" text NOT NULL,
	"event_id" text NOT NULL,
	"character_id" text NOT NULL,
	"expires_at" integer NOT NULL,
	CONSTRAINT "active_events_game_id_id_pk" PRIMARY KEY("game_id","id")
);
--> statement-breakpoint
CREATE TABLE "alliances" (
	"game_id" uuid NOT NULL,
	"id" text NOT NULL,
	"a" text NOT NULL,
	"b" text NOT NULL,
	"reason" text NOT NULL,
	"created_at" integer NOT NULL,
	CONSTRAINT "alliances_game_id_id_pk" PRIMARY KEY("game_id","id")
);
--> statement-breakpoint
CREATE TABLE "armies" (
	"game_id" uuid NOT NULL,
	"id" text NOT NULL,
	"owner_id" text NOT NULL,
	"location" text NOT NULL,
	"men" integer NOT NULL,
	"status" text NOT NULL,
	CONSTRAINT "armies_game_id_id_pk" PRIMARY KEY("game_id","id")
);
--> statement-breakpoint
CREATE TABLE "army_regiments" (
	"game_id" uuid NOT NULL,
	"army_id" text NOT NULL,
	"unit" text NOT NULL,
	"men" integer NOT NULL,
	CONSTRAINT "army_regiments_game_id_army_id_unit_pk" PRIMARY KEY("game_id","army_id","unit")
);
--> statement-breakpoint
CREATE TABLE "battles" (
	"game_id" uuid NOT NULL,
	"id" text NOT NULL,
	"war_id" text NOT NULL,
	"province_id" text NOT NULL,
	"winner" text,
	"attacker_men" integer NOT NULL,
	"defender_men" integer NOT NULL,
	CONSTRAINT "battles_game_id_id_pk" PRIMARY KEY("game_id","id")
);
--> statement-breakpoint
CREATE TABLE "buildings" (
	"game_id" uuid NOT NULL,
	"province_id" text NOT NULL,
	"building_id" text NOT NULL,
	"level" integer NOT NULL,
	CONSTRAINT "buildings_game_id_province_id_building_id_pk" PRIMARY KEY("game_id","province_id","building_id")
);
--> statement-breakpoint
CREATE TABLE "character_traits" (
	"game_id" uuid NOT NULL,
	"character_id" text NOT NULL,
	"trait_id" text NOT NULL,
	CONSTRAINT "character_traits_game_id_character_id_trait_id_pk" PRIMARY KEY("game_id","character_id","trait_id")
);
--> statement-breakpoint
CREATE TABLE "characters" (
	"game_id" uuid NOT NULL,
	"id" text NOT NULL,
	"first_name" text NOT NULL,
	"house_id" text,
	"sex" text NOT NULL,
	"birth" integer NOT NULL,
	"death" integer,
	"father_id" text,
	"mother_id" text,
	"spouse_id" text,
	"liege_id" text,
	"court_id" text,
	"culture_id" text NOT NULL,
	"faith_id" text NOT NULL,
	"primary_title_id" text,
	"gold" double precision NOT NULL,
	"prestige" double precision NOT NULL,
	"health" double precision NOT NULL,
	"stress" double precision NOT NULL,
	"is_player" boolean NOT NULL,
	"alive" boolean NOT NULL,
	CONSTRAINT "characters_game_id_id_pk" PRIMARY KEY("game_id","id")
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_len_ck" CHECK (char_length("chat_messages"."text") between 1 and 500)
);
--> statement-breakpoint
CREATE TABLE "construction_queues" (
	"game_id" uuid NOT NULL,
	"province_id" text NOT NULL,
	"building_id" text NOT NULL,
	"level" integer NOT NULL,
	"started_at" integer NOT NULL,
	"complete_at" integer NOT NULL,
	CONSTRAINT "construction_queues_game_id_province_id_pk" PRIMARY KEY("game_id","province_id")
);
--> statement-breakpoint
CREATE TABLE "council_positions" (
	"game_id" uuid NOT NULL,
	"ruler_id" text NOT NULL,
	"role" text NOT NULL,
	"character_id" text,
	"task" text NOT NULL,
	CONSTRAINT "council_positions_game_id_ruler_id_role_pk" PRIMARY KEY("game_id","ruler_id","role")
);
--> statement-breakpoint
CREATE TABLE "cultures" (
	"id" text PRIMARY KEY NOT NULL,
	"region" text NOT NULL,
	"color" text NOT NULL,
	"succession" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dynasties" (
	"game_id" uuid NOT NULL,
	"id" text NOT NULL,
	"name" text NOT NULL,
	"renown" double precision NOT NULL,
	CONSTRAINT "dynasties_game_id_id_pk" PRIMARY KEY("game_id","id")
);
--> statement-breakpoint
CREATE TABLE "faiths" (
	"id" text PRIMARY KEY NOT NULL,
	"family" text NOT NULL,
	"color" text NOT NULL,
	"doctrines" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_commands" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"game_id" uuid NOT NULL,
	"command_id" text NOT NULL,
	"user_id" uuid,
	"character_id" text,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text NOT NULL,
	"error_code" text,
	"game_version" integer NOT NULL,
	"game_date" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_event_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"game_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"date_in_game" integer NOT NULL,
	"type" text NOT NULL,
	"actor_id" text,
	"payload" jsonb NOT NULL,
	"visible_to" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"code" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "game_players" (
	"game_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"character_id" text,
	"ready" boolean DEFAULT false NOT NULL,
	"is_host" boolean DEFAULT false NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_players_game_id_user_id_pk" PRIMARY KEY("game_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "game_snapshots" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"game_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"game_date" integer NOT NULL,
	"schema_version" integer NOT NULL,
	"reason" text NOT NULL,
	"state" jsonb NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"mode" text NOT NULL,
	"status" text DEFAULT 'lobby' NOT NULL,
	"host_id" uuid NOT NULL,
	"max_players" integer DEFAULT 8 NOT NULL,
	"visibility" text DEFAULT 'private' NOT NULL,
	"settings" jsonb NOT NULL,
	"scenario_id" text NOT NULL,
	"seed" integer NOT NULL,
	"game_date" integer,
	"version" integer DEFAULT 0 NOT NULL,
	"speed" integer DEFAULT 0 NOT NULL,
	"played_seconds" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"last_saved_at" timestamp with time zone,
	CONSTRAINT "games_mode_ck" CHECK ("games"."mode" in ('solo', 'multiplayer')),
	CONSTRAINT "games_status_ck" CHECK ("games"."status" in ('lobby', 'running', 'finished')),
	CONSTRAINT "games_max_players_ck" CHECK ("games"."max_players" between 1 and 8)
);
--> statement-breakpoint
CREATE TABLE "hooks" (
	"game_id" uuid NOT NULL,
	"id" text NOT NULL,
	"owner_id" text NOT NULL,
	"target_id" text NOT NULL,
	"strong" boolean NOT NULL,
	CONSTRAINT "hooks_game_id_id_pk" PRIMARY KEY("game_id","id")
);
--> statement-breakpoint
CREATE TABLE "houses" (
	"game_id" uuid NOT NULL,
	"id" text NOT NULL,
	"dynasty_id" text NOT NULL,
	"name" text NOT NULL,
	"motto" text NOT NULL,
	"head_id" text,
	"renown" double precision NOT NULL,
	"is_major" boolean NOT NULL,
	CONSTRAINT "houses_game_id_id_pk" PRIMARY KEY("game_id","id")
);
--> statement-breakpoint
CREATE TABLE "marriages" (
	"game_id" uuid NOT NULL,
	"husband_id" text NOT NULL,
	"wife_id" text NOT NULL,
	CONSTRAINT "marriages_game_id_husband_id_wife_id_pk" PRIMARY KEY("game_id","husband_id","wife_id")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"game_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"character_id" text NOT NULL,
	"level" text NOT NULL,
	"kind" text NOT NULL,
	"vars" jsonb NOT NULL,
	"focus" jsonb,
	"date_in_game" integer NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provinces" (
	"game_id" uuid NOT NULL,
	"id" text NOT NULL,
	"holder_id" text,
	"development" double precision NOT NULL,
	"control" double precision NOT NULL,
	"culture_id" text NOT NULL,
	"faith_id" text NOT NULL,
	"levies" integer NOT NULL,
	"garrison" integer NOT NULL,
	CONSTRAINT "provinces_game_id_id_pk" PRIMARY KEY("game_id","id")
);
--> statement-breakpoint
CREATE TABLE "relationships" (
	"game_id" uuid NOT NULL,
	"id" text NOT NULL,
	"a" text NOT NULL,
	"b" text NOT NULL,
	"type" text NOT NULL,
	"since" integer NOT NULL,
	CONSTRAINT "relationships_game_id_id_pk" PRIMARY KEY("game_id","id")
);
--> statement-breakpoint
CREATE TABLE "scheme_agents" (
	"game_id" uuid NOT NULL,
	"scheme_id" text NOT NULL,
	"character_id" text NOT NULL,
	CONSTRAINT "scheme_agents_game_id_scheme_id_character_id_pk" PRIMARY KEY("game_id","scheme_id","character_id")
);
--> statement-breakpoint
CREATE TABLE "schemes" (
	"game_id" uuid NOT NULL,
	"id" text NOT NULL,
	"type" text NOT NULL,
	"owner_id" text NOT NULL,
	"target_id" text NOT NULL,
	"progress" double precision NOT NULL,
	"status" text NOT NULL,
	CONSTRAINT "schemes_game_id_id_pk" PRIMARY KEY("game_id","id")
);
--> statement-breakpoint
CREATE TABLE "secrets" (
	"game_id" uuid NOT NULL,
	"id" text NOT NULL,
	"type" text NOT NULL,
	"owner_id" text NOT NULL,
	"exposed" boolean NOT NULL,
	CONSTRAINT "secrets_game_id_id_pk" PRIMARY KEY("game_id","id")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE "sieges" (
	"game_id" uuid NOT NULL,
	"id" text NOT NULL,
	"province_id" text NOT NULL,
	"besieger_id" text NOT NULL,
	"progress" double precision NOT NULL,
	CONSTRAINT "sieges_game_id_id_pk" PRIMARY KEY("game_id","id")
);
--> statement-breakpoint
CREATE TABLE "succession_votes" (
	"game_id" uuid NOT NULL,
	"title_id" text NOT NULL,
	"elector_id" text NOT NULL,
	"candidate_id" text NOT NULL,
	CONSTRAINT "succession_votes_game_id_title_id_elector_id_pk" PRIMARY KEY("game_id","title_id","elector_id")
);
--> statement-breakpoint
CREATE TABLE "title_claims" (
	"game_id" uuid NOT NULL,
	"id" text NOT NULL,
	"character_id" text NOT NULL,
	"title_id" text NOT NULL,
	"kind" text NOT NULL,
	"pressed" boolean NOT NULL,
	CONSTRAINT "title_claims_game_id_id_pk" PRIMARY KEY("game_id","id")
);
--> statement-breakpoint
CREATE TABLE "titles" (
	"game_id" uuid NOT NULL,
	"id" text NOT NULL,
	"rank" text NOT NULL,
	"holder_id" text,
	"de_jure_parent_id" text,
	"succession_law" text NOT NULL,
	"active" boolean NOT NULL,
	"occupied_by" text,
	CONSTRAINT "titles_game_id_id_pk" PRIMARY KEY("game_id","id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "vassal_contracts" (
	"game_id" uuid NOT NULL,
	"vassal_id" text NOT NULL,
	"liege_id" text NOT NULL,
	CONSTRAINT "vassal_contracts_game_id_vassal_id_pk" PRIMARY KEY("game_id","vassal_id")
);
--> statement-breakpoint
CREATE TABLE "war_participants" (
	"game_id" uuid NOT NULL,
	"war_id" text NOT NULL,
	"character_id" text NOT NULL,
	"side" text NOT NULL,
	CONSTRAINT "war_participants_game_id_war_id_character_id_pk" PRIMARY KEY("game_id","war_id","character_id")
);
--> statement-breakpoint
CREATE TABLE "wars" (
	"game_id" uuid NOT NULL,
	"id" text NOT NULL,
	"cb" text NOT NULL,
	"attacker_id" text NOT NULL,
	"defender_id" text NOT NULL,
	"target_title_id" text,
	"war_score" integer NOT NULL,
	"started_at" integer NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	CONSTRAINT "wars_game_id_id_pk" PRIMARY KEY("game_id","id")
);
--> statement-breakpoint
ALTER TABLE "active_events" ADD CONSTRAINT "active_events_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alliances" ADD CONSTRAINT "alliances_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "armies" ADD CONSTRAINT "armies_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "army_regiments" ADD CONSTRAINT "army_regiments_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battles" ADD CONSTRAINT "battles_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buildings" ADD CONSTRAINT "buildings_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_traits" ADD CONSTRAINT "character_traits_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "construction_queues" ADD CONSTRAINT "construction_queues_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "council_positions" ADD CONSTRAINT "council_positions_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dynasties" ADD CONSTRAINT "dynasties_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_commands" ADD CONSTRAINT "game_commands_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_commands" ADD CONSTRAINT "game_commands_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_event_log" ADD CONSTRAINT "game_event_log_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_invites" ADD CONSTRAINT "game_invites_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_invites" ADD CONSTRAINT "game_invites_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_players" ADD CONSTRAINT "game_players_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_players" ADD CONSTRAINT "game_players_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_snapshots" ADD CONSTRAINT "game_snapshots_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_host_id_users_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hooks" ADD CONSTRAINT "hooks_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "houses" ADD CONSTRAINT "houses_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marriages" ADD CONSTRAINT "marriages_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provinces" ADD CONSTRAINT "provinces_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheme_agents" ADD CONSTRAINT "scheme_agents_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schemes" ADD CONSTRAINT "schemes_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "secrets" ADD CONSTRAINT "secrets_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sieges" ADD CONSTRAINT "sieges_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "succession_votes" ADD CONSTRAINT "succession_votes_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "title_claims" ADD CONSTRAINT "title_claims_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "titles" ADD CONSTRAINT "titles_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vassal_contracts" ADD CONSTRAINT "vassal_contracts_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "war_participants" ADD CONSTRAINT "war_participants_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wars" ADD CONSTRAINT "wars_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "armies_owner_idx" ON "armies" USING btree ("game_id","owner_id");--> statement-breakpoint
CREATE INDEX "characters_house_idx" ON "characters" USING btree ("game_id","house_id");--> statement-breakpoint
CREATE INDEX "characters_liege_idx" ON "characters" USING btree ("game_id","liege_id");--> statement-breakpoint
CREATE INDEX "characters_alive_idx" ON "characters" USING btree ("game_id","alive");--> statement-breakpoint
CREATE INDEX "chat_messages_game_idx" ON "chat_messages" USING btree ("game_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "game_commands_uq" ON "game_commands" USING btree ("game_id","command_id");--> statement-breakpoint
CREATE INDEX "game_commands_game_idx" ON "game_commands" USING btree ("game_id","id");--> statement-breakpoint
CREATE INDEX "game_event_log_game_idx" ON "game_event_log" USING btree ("game_id","sequence");--> statement-breakpoint
CREATE INDEX "game_event_log_type_idx" ON "game_event_log" USING btree ("game_id","type");--> statement-breakpoint
CREATE UNIQUE INDEX "game_invites_code_uq" ON "game_invites" USING btree ("code");--> statement-breakpoint
CREATE INDEX "game_invites_game_idx" ON "game_invites" USING btree ("game_id");--> statement-breakpoint
CREATE UNIQUE INDEX "game_players_character_uq" ON "game_players" USING btree ("game_id","character_id");--> statement-breakpoint
CREATE INDEX "game_players_user_idx" ON "game_players" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "game_snapshots_game_idx" ON "game_snapshots" USING btree ("game_id","id");--> statement-breakpoint
CREATE INDEX "games_status_idx" ON "games" USING btree ("status");--> statement-breakpoint
CREATE INDEX "games_host_idx" ON "games" USING btree ("host_id");--> statement-breakpoint
CREATE INDEX "houses_dynasty_idx" ON "houses" USING btree ("game_id","dynasty_id");--> statement-breakpoint
CREATE INDEX "notifications_user_game_idx" ON "notifications" USING btree ("game_id","user_id","id");--> statement-breakpoint
CREATE INDEX "provinces_holder_idx" ON "provinces" USING btree ("game_id","holder_id");--> statement-breakpoint
CREATE INDEX "relationships_a_idx" ON "relationships" USING btree ("game_id","a");--> statement-breakpoint
CREATE INDEX "relationships_b_idx" ON "relationships" USING btree ("game_id","b");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_uq" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "title_claims_char_idx" ON "title_claims" USING btree ("game_id","character_id");--> statement-breakpoint
CREATE INDEX "titles_holder_idx" ON "titles" USING btree ("game_id","holder_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uq" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_uq" ON "users" USING btree (lower("username"));--> statement-breakpoint
CREATE INDEX "vassal_contracts_liege_idx" ON "vassal_contracts" USING btree ("game_id","liege_id");--> statement-breakpoint
CREATE INDEX "wars_status_idx" ON "wars" USING btree ("game_id","status");