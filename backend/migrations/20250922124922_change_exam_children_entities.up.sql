DO
$$
    BEGIN
        CREATE TYPE EXAM_ENTITY_TYPE AS ENUM ('task', 'text');
    EXCEPTION
        WHEN duplicate_object THEN NULL;
    END;
$$;

CREATE TABLE IF NOT EXISTS exam_texts
(
    id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    text TEXT NOT NULL
);

ALTER TABLE IF EXISTS exam_tasks
    DROP CONSTRAINT exam_tasks_pkey;
ALTER TABLE IF EXISTS exam_tasks
    RENAME TO exam_entities;
ALTER TABLE IF EXISTS exam_entities
    ALTER COLUMN task_id DROP NOT NULL;
ALTER TABLE IF EXISTS exam_entities
    ADD COLUMN text_id UUID REFERENCES exam_texts (id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS exam_entities
    ADD COLUMN entity_type EXAM_ENTITY_TYPE NOT NULL DEFAULT 'task';
