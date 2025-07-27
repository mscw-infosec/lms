ALTER TABLE attempts
    DROP CONSTRAINT attempts_pkey;
ALTER TABLE attempts
    ADD COLUMN id UUID PRIMARY KEY DEFAULT gen_random_uuid();
ALTER TABLE attempts
    DROP COLUMN try_number;