DROP TABLE IF EXISTS attempts;
CREATE TABLE attempts
(
    id           UUID PRIMARY KEY                                         DEFAULT gen_random_uuid(),
    user_id      UUID REFERENCES users (id) ON DELETE CASCADE    NOT NULL,
    task_id      INTEGER REFERENCES tasks (id) ON DELETE CASCADE NOT NULL,
    answer       JSONB                                           NOT NULL,
    submitted_at TIMESTAMPTZ                                     NOT NULL DEFAULT now()
);

ALTER TABLE tasks
    ADD COLUMN tries_count INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS task_links
(
    topic_id    INTEGER REFERENCES topics (id) ON DELETE CASCADE,
    task_id     INTEGER REFERENCES tasks (id) ON DELETE CASCADE,
    order_index INTEGER NOT NULL,
    PRIMARY KEY (topic_id, task_id)
);

DROP TABLE IF EXISTS exam_tasks;
DROP TABLE IF EXISTS exam_ordering;
DROP TABLE IF EXISTS exams;
DROP TYPE IF EXISTS EXAM_TYPE;
