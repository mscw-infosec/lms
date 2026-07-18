CREATE TABLE IF NOT EXISTS practice_links
(
    topic_id    INTEGER NOT NULL REFERENCES topics (id) ON DELETE CASCADE,
    task_id     INTEGER NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
    order_index INTEGER NOT NULL,
    PRIMARY KEY (topic_id, task_id),
    UNIQUE (topic_id, order_index)
);

DROP TABLE IF EXISTS practice_tasks;
DROP TABLE IF EXISTS practices;
