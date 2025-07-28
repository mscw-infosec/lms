DO
$$
    BEGIN
        CREATE TYPE TASK_TYPE AS ENUM ('single_choice', 'multiple_choice', 'short_text', 'long_text', 'ordering', 'file_upload', 'ctfd');
    EXCEPTION
        WHEN DUPLICATE_OBJECT THEN NULL;
    END
$$;

CREATE TABLE IF NOT EXISTS courses
(
    id          SERIAL PRIMARY KEY,
    title       VARCHAR NOT NULL,
    description VARCHAR,
    created_at  timestamptz default now()
);

CREATE TABLE IF NOT EXISTS course_owners
(
    course_id INTEGER REFERENCES courses (id) ON DELETE CASCADE,
    user_id   UUID REFERENCES users (id) ON DELETE CASCADE,
    PRIMARY KEY (course_id, user_id)
);

CREATE TABLE IF NOT EXISTS topics
(
    id          SERIAL PRIMARY KEY,
    course_id   INTEGER REFERENCES courses (id) ON DELETE CASCADE NOT NULL,
    title       TEXT                                              NOT NULL,
    order_index INTEGER                                           NOT NULL
);

CREATE TABLE IF NOT EXISTS lectures
(
    id          SERIAL PRIMARY KEY,
    title       TEXT    NOT NULL,
    description TEXT,
    video_id    VARCHAR(20) REFERENCES videos (id),
    order_index INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks
(
    id            SERIAL PRIMARY KEY,
    title         TEXT      NOT NULL,
    description   TEXT,
    tries_count   INTEGER   NOT NULL DEFAULT 0,
    task_type     TASK_TYPE NOT NULL,
    points        INTEGER   NOT NULL,
    configuration JSONB     NOT NULL
);

CREATE TABLE IF NOT EXISTS task_links
(
    topic_id    INTEGER REFERENCES topics (id) ON DELETE CASCADE,
    task_id     INTEGER REFERENCES tasks (id) ON DELETE CASCADE,
    order_index INTEGER NOT NULL,
    PRIMARY KEY (topic_id, task_id)
);

CREATE TABLE IF NOT EXISTS lecture_links
(
    topic_id    INTEGER REFERENCES topics (id) ON DELETE CASCADE,
    lecture_id  INTEGER REFERENCES lectures (id) ON DELETE CASCADE,
    order_index INTEGER NOT NULL,
    PRIMARY KEY (topic_id, lecture_id)
);

CREATE TABLE IF NOT EXISTS attempts
(
    user_id      UUID REFERENCES users (id) ON DELETE CASCADE    NOT NULL,
    task_id      INTEGER REFERENCES tasks (id) ON DELETE CASCADE NOT NULL,
    answer       JSONB                                           NOT NULL,
    try_number   INTEGER                                         NOT NULL,
    submitted_at TIMESTAMPTZ                                     NOT NULL DEFAULT now(),
    primary key (user_id, task_id, try_number)
);

CREATE TABLE IF NOT EXISTS files
(
    id UUID PRIMARY KEY
);