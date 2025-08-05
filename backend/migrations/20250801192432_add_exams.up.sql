DO
$$
    BEGIN
        CREATE TYPE EXAM_TYPE AS ENUM ('Instant', 'Delayed');
    EXCEPTION
        WHEN duplicate_object THEN NULL;
    END;
$$;

CREATE TABLE IF NOT EXISTS exams
(
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_id    INTEGER   NOT NULL REFERENCES topics (id) ON DELETE CASCADE, -- exams can't exist without topic
    tries_count INTEGER   NOT NULL,                                          -- 0 means unlimited
    duration    INTEGER   NOT NULL,                                          -- time in seconds, 0 means unlimited
    exam_type   EXAM_TYPE NOT NULL
);

CREATE TABLE IF NOT EXISTS exam_ordering
(
    exam_id     UUID    NOT NULL REFERENCES exams (id) ON DELETE CASCADE,
    topic_id    INTEGER NOT NULL REFERENCES topics (id) ON DELETE CASCADE,
    order_index INTEGER NOT NULL,
    PRIMARY KEY (topic_id, exam_id), -- exam can only be used once for a topic
    UNIQUE (topic_id, order_index)   -- there can't be duplicate indexes for a topic
);

CREATE TABLE IF NOT EXISTS exam_tasks
(
    exam_id     UUID    NOT NULL REFERENCES exams (id) ON DELETE CASCADE,
    task_id     INTEGER NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
    order_index INTEGER NOT NULL,
    PRIMARY KEY (exam_id, task_id), -- exam can only be used once for an exam
    UNIQUE (exam_id, order_index)   -- there can't be duplicate indexes for an exam
);
DROP TABLE task_links;

ALTER TABLE tasks
    DROP COLUMN tries_count;

DROP TABLE IF EXISTS attempts;
CREATE TABLE attempts
(
    id           UUID PRIMARY KEY     DEFAULT gen_random_uuid(),
    exam_id      UUID        NOT NULL REFERENCES exams (id) ON DELETE CASCADE,
    user_id      UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    active       BOOLEAN     NOT NULL DEFAULT TRUE,
    answer_data  JSONB       NOT NULL,
    scoring_data JSONB       NOT NULL
);
CREATE INDEX idx_exam_attempt_active_started ON attempts (active, started_at);
