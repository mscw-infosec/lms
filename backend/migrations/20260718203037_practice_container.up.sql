CREATE TABLE IF NOT EXISTS practices
(
    id          SERIAL PRIMARY KEY,
    topic_id    INTEGER NOT NULL REFERENCES topics (id) ON DELETE CASCADE,
    title       TEXT    NOT NULL,
    description TEXT,
    order_index INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS practice_tasks
(
    practice_id INTEGER NOT NULL REFERENCES practices (id) ON DELETE CASCADE,
    task_id     INTEGER NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
    order_index INTEGER NOT NULL,
    PRIMARY KEY (practice_id, task_id),
    UNIQUE (practice_id, order_index)
);

DROP TABLE IF EXISTS practice_links;
