CREATE TABLE IF NOT EXISTS attachments
(
    id           UUID PRIMARY KEY     DEFAULT gen_random_uuid(),
    lecture_id   INTEGER REFERENCES lectures (id) ON DELETE CASCADE,
    task_id      INTEGER REFERENCES tasks (id) ON DELETE CASCADE,
    file_name    TEXT        NOT NULL,
    content_type TEXT        NOT NULL,
    size         BIGINT      NOT NULL,
    s3_key       TEXT        NOT NULL UNIQUE,
    uploaded_by  UUID        REFERENCES users (id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    uploaded_at  TIMESTAMPTZ,
    -- an attachment belongs to exactly one owner
    CHECK (num_nonnulls(lecture_id, task_id) = 1)
);

CREATE INDEX IF NOT EXISTS attachments_lecture_id_idx ON attachments (lecture_id);
CREATE INDEX IF NOT EXISTS attachments_task_id_idx ON attachments (task_id);
-- finds abandoned uploads
CREATE INDEX IF NOT EXISTS attachments_pending_idx ON attachments (created_at) WHERE uploaded_at IS NULL;

CREATE TABLE IF NOT EXISTS s3_deletion_queue
(
    s3_key      TEXT PRIMARY KEY,
    enqueued_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION enqueue_attachment_object_deletion() RETURNS TRIGGER AS
$$
BEGIN
    INSERT INTO s3_deletion_queue (s3_key) VALUES (OLD.s3_key) ON CONFLICT DO NOTHING;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER attachments_enqueue_object_deletion
    AFTER DELETE
    ON attachments
    FOR EACH ROW
EXECUTE FUNCTION enqueue_attachment_object_deletion();
