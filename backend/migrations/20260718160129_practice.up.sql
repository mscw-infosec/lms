CREATE TABLE IF NOT EXISTS practice_links
(
    topic_id    INTEGER NOT NULL REFERENCES topics (id) ON DELETE CASCADE,
    task_id     INTEGER NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
    order_index INTEGER NOT NULL,
    PRIMARY KEY (topic_id, task_id),
    UNIQUE (topic_id, order_index)
);

CREATE TABLE IF NOT EXISTS practice_progress
(
    user_id     UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    task_id     INTEGER     NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
    solved      BOOLEAN     NOT NULL DEFAULT FALSE,
    attempts    INTEGER     NOT NULL DEFAULT 0,
    last_answer JSONB,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, task_id)
);
