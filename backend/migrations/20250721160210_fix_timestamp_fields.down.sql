ALTER TABLE courses
    ALTER COLUMN created_at DROP NOT NULL;

ALTER TABLE attempts
    ALTER COLUMN submitted_at DROP NOT NULL;
