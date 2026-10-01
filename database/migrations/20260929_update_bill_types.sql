-- Non-destructive bill-type update.
-- Existing payment rows keep their original payment_type_id, including
-- historical Penalty and Special Assessment entries. Those types are simply
-- retired from future bill generation.

BEGIN;

ALTER TABLE payment_types
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE payment_types
    ADD COLUMN IF NOT EXISTS display_order SMALLINT NOT NULL DEFAULT 999;

INSERT INTO payment_types (payment_name, description, is_active, display_order) VALUES
    ('Monthly HOA Dues', 'Regular monthly association fee.', TRUE, 1),
    ('Monthly HOA Dues + Penalty', 'Monthly HOA dues with the applicable outstanding-balance penalty.', TRUE, 2),
    ('Car Sticker', 'Vehicle sticker or registration fee.', TRUE, 3),
    ('Construction Fee', 'Construction-related HOA fee.', TRUE, 4),
    ('Membership Fee', 'HOA membership fee.', TRUE, 5)
ON CONFLICT (payment_name) DO UPDATE
SET description = EXCLUDED.description,
    is_active = TRUE,
    display_order = EXCLUDED.display_order;

UPDATE payment_types
SET is_active = FALSE,
    display_order = 999
WHERE payment_name IN ('Penalty', 'Special Assessment');

COMMIT;

COMMENT ON COLUMN payment_types.is_active IS
    'Controls whether officers can select a type for new bills. Inactive types remain available to historical payment records.';
