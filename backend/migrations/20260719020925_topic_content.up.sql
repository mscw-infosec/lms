CREATE TABLE IF NOT EXISTS topic_texts
(
    id          SERIAL PRIMARY KEY,
    topic_id    INTEGER NOT NULL REFERENCES topics (id) ON DELETE CASCADE,
    title       TEXT    NOT NULL,
    content     TEXT    NOT NULL,
    order_index INTEGER NOT NULL DEFAULT 0
);
