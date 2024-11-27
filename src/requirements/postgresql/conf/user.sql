SELECT 'CREATE DATABASE users'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'users')\gexec

ALTER DATABASE users SET timezone TO 'Europe/Paris';

GRANT ALL PRIVILEGES ON DATABASE users TO "42";

\c users;

CREATE TABLE "user" (
  "uid" uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "display_name" text NOT NULL,
  "username" text NOT NULL,
  "password" text NOT NULL,
  "mail_address" text NOT NULL,
  "avatar_url" text NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "is_superuser" boolean NOT NULL DEFAULT false,
  -- GAME RELATED -- GAME RELATED -- GAME RELATED -- GAME RELATED --
  "last_seen" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "is_online" boolean NOT NULL DEFAULT false,
  "game_win" integer NOT NULL DEFAULT 0,
  "game_loss" integer NOT NULL DEFAULT 0,
  "game_count" integer NOT NULL DEFAULT 0
);