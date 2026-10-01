-- SmartHOA Database Seeder (seed.sql)
-- Initial data required for the system to function correctly

-- 1. Roles
INSERT INTO roles (role_name, description) VALUES
('Super Administrator', 'Full system access, can manage officers and settings.'),
('HOA Officer', 'Handles complaints, payments, and day-to-day HOA operations.'),
('Homeowner', 'Resident who owns a property in the subdivision.'),
('Renter', 'Resident who rents a property in the subdivision.')
ON CONFLICT (role_name) DO NOTHING;

-- 2. Complaint Categories
INSERT INTO complaint_categories (category_name, description) VALUES
('Maintenance', 'Issues regarding facilities, streetlights, potholes, etc.'),
('Security', 'Suspicious activities, gate pass issues, safety concerns.'),
('Noise', 'Loud music, construction noise out of hours.'),
('Parking', 'Illegal parking, blocking driveways.'),
('Utilities', 'Water interruptions, electrical issues within HOA jurisdiction.'),
('Cleanliness', 'Garbage disposal issues, unmaintained lots.'),
('Others', 'Any other issues not classified above.')
ON CONFLICT (category_name) DO NOTHING;

-- 3. Payment Types
-- Retired types are deliberately not seeded here. Existing records that use
-- them remain intact through the non-destructive payment-type migration.
INSERT INTO payment_types (payment_name, description, is_active, display_order) VALUES
('Monthly HOA Dues', 'Regular monthly association fee.', TRUE, 1),
('Monthly HOA Dues + Penalty', 'Monthly HOA dues with the applicable outstanding-balance penalty.', TRUE, 2),
('Car Sticker', 'Vehicle sticker or registration fee.', TRUE, 3),
('Construction Fee', 'Construction-related HOA fee.', TRUE, 4),
('Membership Fee', 'HOA membership fee.', TRUE, 5)
ON CONFLICT (payment_name) DO UPDATE
SET description = EXCLUDED.description,
    is_active = EXCLUDED.is_active,
    display_order = EXCLUDED.display_order;

-- 4. System Settings
INSERT INTO system_settings (setting_key, setting_value, description) VALUES
('monthly_hoa_fee', '325.00', 'Default monthly HOA fee amount, payable on or before the 16th.'),
('penalty_rate', '0.10', '10% compounding interest applied to the total outstanding balance every 16th.'),
('community_name', 'Southwynd Subd', 'The official name of the HOA community.'),
('office_hours', 'Mon-Sat 9AM-5PM', 'HOA Management Office operating hours.'),
('ai_confidence_threshold', '0.80', 'Minimum confidence score for auto-categorization.')
ON CONFLICT (setting_key) DO NOTHING;
