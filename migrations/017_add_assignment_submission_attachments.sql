BEGIN;

ALTER TABLE assignments
    ADD COLUMN IF NOT EXISTS submission_attachments JSONB DEFAULT '[]'::jsonb;

UPDATE assignments
SET submission_attachments = '[]'::jsonb
WHERE submission_attachments IS NULL;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'assignment-submissions',
    'assignment-submissions',
    FALSE,
    41943040,
    ARRAY[
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'audio/mpeg',
        'audio/mp3',
        'audio/mp4',
        'audio/x-m4a',
        'video/mp4',
        'image/jpeg',
        'image/png'
    ]
)
ON CONFLICT (id) DO NOTHING;

COMMIT;
