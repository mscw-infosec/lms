CREATE TABLE IF NOT EXISTS lecture_notes
(
    user_id    UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    lecture_id INTEGER     NOT NULL REFERENCES lectures (id) ON DELETE CASCADE,
    content    TEXT        NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, lecture_id)
);
