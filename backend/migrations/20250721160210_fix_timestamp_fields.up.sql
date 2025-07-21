ALTER TABLE courses
    ALTER COLUMN created_at SET NOT NULL;

ALTER TABLE attempts
    ALTER COLUMN submitted_at SET NOT NULL;