-- Add up migration script here
CREATE TYPE ENTITY_TYPE AS ENUM ('exam', 'text', 'video');
CREATE TABLE entities (
                          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                          topic_id INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
                          type ENTITY_TYPE NOT NULL,
                          order_id INTEGER NOT NULL,
                          entity_version INTEGER NOT NULL DEFAULT 1,
                          entity_data TEXT NOT NULL
);

-- Optional index for fast lookups by topic
CREATE INDEX idx_entities_topic_id ON entities (topic_id);

-- Optional index for ordering within topics
CREATE INDEX idx_entities_topic_order ON entities (topic_id, order_id);
