ALTER TABLE users
    ADD COLUMN IF NOT EXISTS first_name     TEXT,
    ADD COLUMN IF NOT EXISTS last_name      TEXT,
    ADD COLUMN IF NOT EXISTS patronymic     TEXT,
    ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;

-- Grandfather in all currently existing users on the email-verification axis.
-- They will still be forced to complete their names, because first_name /
-- last_name are NULL for them (in particular for every OAuth user).
UPDATE users SET email_verified = TRUE;
