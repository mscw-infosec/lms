ALTER TABLE exams
    ADD COLUMN name TEXT NOT NULL DEFAULT 'Экзамен';
ALTER TABLE exams
    ADD COLUMN description TEXT;
