CREATE TABLE IF NOT EXISTS sso_clients
(
    id                        UUID PRIMARY KEY     DEFAULT gen_random_uuid(),
    client_id                 TEXT        NOT NULL UNIQUE,
    client_secret             TEXT,
    name                      TEXT        NOT NULL,
    description               TEXT,
    logo_url                  TEXT,
    redirect_uris             TEXT[]      NOT NULL DEFAULT '{}',
    post_logout_redirect_uris TEXT[]      NOT NULL DEFAULT '{}',
    allowed_scopes            TEXT[]      NOT NULL DEFAULT '{openid,profile,email}',
    is_public                 BOOLEAN     NOT NULL DEFAULT FALSE,
    skip_consent              BOOLEAN     NOT NULL DEFAULT FALSE,
    enabled                   BOOLEAN     NOT NULL DEFAULT TRUE,
    created_by                UUID REFERENCES users (id) ON DELETE SET NULL,
    created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sso_consents
(
    user_id    UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    client_id  TEXT        NOT NULL REFERENCES sso_clients (client_id) ON DELETE CASCADE,
    scopes     TEXT[]      NOT NULL DEFAULT '{}',
    granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, client_id)
);

CREATE INDEX IF NOT EXISTS sso_consents_client_id_idx ON sso_consents (client_id);
