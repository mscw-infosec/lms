CREATE TABLE IF NOT EXISTS videos
(
    id        VARCHAR(20) PRIMARY KEY,
    url       VARCHAR NOT NULL,
    file_size BIGINT  NOT NULL,
    file_name VARCHAR NOT NULL
)