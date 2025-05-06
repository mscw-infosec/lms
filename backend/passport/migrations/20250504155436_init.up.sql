DO
$$
    BEGIN
        CREATE TYPE UserRole AS ENUM ('Student', 'Teacher', 'Admin');
    EXCEPTION
        WHEN duplicate_object THEN NULL;
    end;
$$;


CREATE TABLE IF NOT EXISTS users
(
    id         UUID PRIMARY KEY     DEFAULT gen_random_uuid(),
    username   TEXT        NOT NULL UNIQUE,
    email      TEXT        NOT NULL UNIQUE,
    role       UserRole    NOT NULL DEFAULT 'Student',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth_credentials
(
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            UUID REFERENCES users (id) ON DELETE CASCADE,
    provider           TEXT NOT NULL, -- 'basic', 'github', 'totp', 'passkey', 'recovery_code'
    provider_user_id   TEXT,          -- OAuth user id, passkey credential id, or null for local
    password_hash      TEXT,          -- for 'local'
    totp_secret        TEXT,          -- base32 encoded secret for TOTP
    passkey_public_key BYTEA,         -- public key for passkey
    passkey_sign_count BIGINT,        -- sign count for passkey
    created_at         TIMESTAMPTZ      DEFAULT now(),
    UNIQUE (user_id, provider, provider_user_id)
);

CREATE TABLE IF NOT EXISTS recovery_codes
(
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID REFERENCES users (id) ON DELETE CASCADE,
    code_hash  TEXT NOT NULL, -- hashed recovery code
    used       BOOLEAN          DEFAULT FALSE,
    created_at TIMESTAMPTZ      DEFAULT now()
);

