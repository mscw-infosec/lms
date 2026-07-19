DO
$$
    BEGIN
        CREATE TYPE EXAM_SCORING_POLICY AS ENUM ('best', 'latest', 'average');
    EXCEPTION
        WHEN duplicate_object THEN NULL;
    END;
$$;

ALTER TABLE exams
    ADD COLUMN IF NOT EXISTS scoring_policy EXAM_SCORING_POLICY NOT NULL DEFAULT 'best';
