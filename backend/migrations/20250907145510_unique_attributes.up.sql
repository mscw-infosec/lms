ALTER TABLE attributes
    ADD CONSTRAINT unique_attribute_key_per_user_id UNIQUE (user_id, key);
