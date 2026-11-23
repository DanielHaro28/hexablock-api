-- Hand-written part (Prisma cannot express it in schema.prisma) — ARQ-04-API §1 and §2.
-- Case-insensitive text for the unique email and display name (RN-COM-109).
CREATE EXTENSION IF NOT EXISTS citext;

-- Order of change of the levels: the cursor of the level download (D-48). Never repeats.
CREATE SEQUENCE "levels_change_seq" AS BIGINT;

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" CITEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "display_name" CITEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "progress" (
    "user_id" UUID NOT NULL,
    "game_id" TEXT NOT NULL,
    "sections" JSONB NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "progress_pkey" PRIMARY KEY ("user_id","game_id")
);

-- CreateTable
CREATE TABLE "best_attempts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "game_id" TEXT NOT NULL,
    "topology" TEXT NOT NULL,
    "level_id" TEXT NOT NULL DEFAULT '',
    "stars" INTEGER,
    "time_ms" INTEGER,
    "moves" INTEGER,
    "score" INTEGER,
    "achieved_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "best_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "levels" (
    "id" TEXT NOT NULL,
    "game_id" TEXT NOT NULL,
    "topology" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "data" JSONB NOT NULL,
    "change_seq" BIGINT NOT NULL DEFAULT nextval('levels_change_seq'),
    "published_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "levels_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_display_name_key" ON "users"("display_name");

-- CreateIndex
CREATE INDEX "best_attempts_game_id_topology_level_id_idx" ON "best_attempts"("game_id", "topology", "level_id");

-- CreateIndex
CREATE UNIQUE INDEX "best_attempts_user_id_game_id_topology_level_id_key" ON "best_attempts"("user_id", "game_id", "topology", "level_id");

-- CreateIndex
CREATE UNIQUE INDEX "levels_change_seq_key" ON "levels"("change_seq");

-- CreateIndex
CREATE INDEX "levels_game_id_topology_change_seq_idx" ON "levels"("game_id", "topology", "change_seq");

-- AddForeignKey
ALTER TABLE "progress" ADD CONSTRAINT "progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "best_attempts" ADD CONSTRAINT "best_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Hand-written part: a level that is updated gets a new change_seq (an INSERT gets it from the column default).
-- Prisma cannot assign a sequence value on UPDATE, so a trigger does it (ARQ-04-API §2, notes).
CREATE FUNCTION "levels_set_change_seq"() RETURNS TRIGGER AS $$
BEGIN
    NEW."change_seq" := nextval('levels_change_seq');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "levels_change_seq_on_update"
    BEFORE UPDATE ON "levels"
    FOR EACH ROW EXECUTE FUNCTION "levels_set_change_seq"();
