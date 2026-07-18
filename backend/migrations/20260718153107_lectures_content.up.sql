ALTER TABLE lectures
    ADD COLUMN IF NOT EXISTS content TEXT;

ALTER TABLE lectures
    DROP COLUMN IF EXISTS order_index;

CREATE TABLE IF NOT EXISTS lecture_progress
(
    user_id      UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    lecture_id   INTEGER     NOT NULL REFERENCES lectures (id) ON DELETE CASCADE,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, lecture_id)
);
