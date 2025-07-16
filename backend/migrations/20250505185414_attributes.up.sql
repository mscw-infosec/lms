-- Add up migration script here

CREATE TABLE IF NOT EXISTS attributes
(
    id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users (id) ON DELETE CASCADE,
    key     VARCHAR NOT NULL,
    value   VARCHAR NOT NULL
);

CREATE INDEX ON attributes(user_id);
