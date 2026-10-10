CREATE TABLE IF NOT EXISTS teachers (
 id UUID PRIMARY KEY,
 email TEXT NOT NULL UNIQUE,
 name TEXT NOT NULL,
 password_hash TEXT NOT NULL,
 class_name TEXT NOT NULL DEFAULT 'My class',
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS students (
 id UUID NOT NULL,
 teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
 name TEXT NOT NULL,
 house TEXT NOT NULL,
 position INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY (teacher_id, id)
);
CREATE TABLE IF NOT EXISTS scores (
 teacher_id UUID NOT NULL,
 student_id UUID NOT NULL,
 day DATE NOT NULL,
 kind TEXT NOT NULL CHECK (kind IN ('quran', 'memorisation')),
 value SMALLINT NOT NULL CHECK (value BETWEEN 1 AND 5),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 PRIMARY KEY (teacher_id, student_id, day, kind),
 FOREIGN KEY (teacher_id, student_id) REFERENCES students(teacher_id, id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash TEXT PRIMARY KEY,
 teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
 expires_at TIMESTAMPTZ NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS auth_limits (
 key TEXT PRIMARY KEY,
 attempts INTEGER NOT NULL,
 expires_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE teachers ADD COLUMN IF NOT EXISTS bio TEXT NOT NULL DEFAULT '';
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS theme TEXT NOT NULL DEFAULT 'system';
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS avatar BYTEA;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS avatar_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS memorisation_passes (
 teacher_id UUID NOT NULL,
 student_id UUID NOT NULL,
 day DATE NOT NULL,
 level SMALLINT NOT NULL CHECK (level > 0),
 target SMALLINT NOT NULL CHECK (target > 0),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 PRIMARY KEY (teacher_id, student_id, day),
 FOREIGN KEY (teacher_id, student_id) REFERENCES students(teacher_id, id) ON DELETE CASCADE
);
-- Old numeric memorisation scores remain in scores for recovery, but are no
-- longer read as valid passes. A number cannot determine a level and target.
