ALTER TABLE attempts
    DROP COLUMN id;
ALTER TABLE attempts
    ADD COLUMN try_number INTEGER NOT NULL;
ALTER TABLE attempts
    ADD CONSTRAINT attempts_pkey PRIMARY KEY (user_id, task_id, try_number);
