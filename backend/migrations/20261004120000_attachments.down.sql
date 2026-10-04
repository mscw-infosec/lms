DROP TRIGGER IF EXISTS attachments_enqueue_object_deletion ON attachments;
DROP FUNCTION IF EXISTS enqueue_attachment_object_deletion();
DROP TABLE IF EXISTS s3_deletion_queue;
DROP TABLE IF EXISTS attachments;
