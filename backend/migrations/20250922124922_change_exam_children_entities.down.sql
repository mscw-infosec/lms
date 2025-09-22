ALTER TABLE IF EXISTS exam_entities
    DROP COLUMN entity_type;
ALTER TABLE IF EXISTS exam_entities
    DROP COLUMN text_id;
ALTER TABLE IF EXISTS exam_entities
    ALTER COLUMN task_id SET NOT NULL;
ALTER TABLE IF EXISTS exam_entities
    RENAME TO exam_tasks;
ALTER TABLE IF EXISTS exam_tasks
    ADD CONSTRAINT exam_tasks_pkey PRIMARY KEY (exam_id, task_id);

DROP TABLE IF EXISTS exam_texts;
DROP TYPE IF EXISTS EXAM_ENTITY_TYPE;
