-- SmartHOA PostgreSQL Schema (Supabase) v2.0
-- AI/ML components removed — Decision Support & Community Analytics focus

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================
-- CLEAN SLATE: DROP EXISTING TABLES & TYPES
-- ==============================================
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS feedback CASCADE;
DROP TABLE IF EXISTS airbnb_host_properties CASCADE;
DROP TABLE IF EXISTS announcements CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS complaint_updates CASCADE;
DROP TABLE IF EXISTS complaint_assignments CASCADE;
DROP TABLE IF EXISTS complaint_attachments CASCADE;
DROP TABLE IF EXISTS complaints CASCADE;
DROP TABLE IF EXISTS complaint_categories CASCADE;
DROP TABLE IF EXISTS payment_receipts CASCADE;
DROP TABLE IF EXISTS dues_policy_assessments CASCADE;
DROP TABLE IF EXISTS payment_transactions CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS payment_types CASCADE;
DROP TABLE IF EXISTS resident_profiles CASCADE;
DROP TABLE IF EXISTS properties CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS roles CASCADE;
DROP TABLE IF EXISTS system_settings CASCADE;

DROP TYPE IF EXISTS account_status_enum CASCADE;
DROP TYPE IF EXISTS property_status_enum CASCADE;
DROP TYPE IF EXISTS resident_type_enum CASCADE;
DROP TYPE IF EXISTS resident_status_enum CASCADE;
DROP TYPE IF EXISTS sex_enum CASCADE;
DROP TYPE IF EXISTS payment_status_enum CASCADE;
DROP TYPE IF EXISTS complaint_status_enum CASCADE;
DROP TYPE IF EXISTS urgency_level_enum CASCADE;
DROP TYPE IF EXISTS notification_type_enum CASCADE;

-- ENUMS
CREATE TYPE account_status_enum AS ENUM ('Active', 'Inactive', 'Suspended');
CREATE TYPE property_status_enum AS ENUM ('Occupied', 'Vacant');
CREATE TYPE resident_type_enum AS ENUM ('Homeowner', 'Renter');
CREATE TYPE resident_status_enum AS ENUM ('Active', 'Inactive');
CREATE TYPE sex_enum AS ENUM ('Male', 'Female', 'Other');
CREATE TYPE payment_status_enum AS ENUM ('Pending', 'Paid', 'Overdue', 'Failed', 'Cancelled');
CREATE TYPE complaint_status_enum AS ENUM ('Submitted', 'Assigned', 'In Progress', 'Resolved', 'Closed');
CREATE TYPE urgency_level_enum AS ENUM ('Low', 'Medium', 'High', 'Critical');
CREATE TYPE notification_type_enum AS ENUM ('General', 'Payment', 'Complaint', 'System');

-- MODULE: System Settings
CREATE TABLE system_settings (
    setting_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- MODULE A: Authentication & User Management
CREATE TABLE roles (
    role_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_id UUID REFERENCES roles(role_id) ON DELETE SET NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    account_status account_status_enum DEFAULT 'Active',
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- MODULE B: Property & Resident Management
CREATE TABLE properties (
    property_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    block VARCHAR(10) NOT NULL,
    lot VARCHAR(10) NOT NULL,
    property_status property_status_enum DEFAULT 'Vacant',
    property_use VARCHAR(20) NOT NULL DEFAULT 'Homeowner' CHECK (property_use IN ('Homeowner', 'Renter', 'Airbnb')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(block, lot)
);

CREATE TABLE resident_profiles (
    resident_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
    property_id UUID REFERENCES properties(property_id) ON DELETE SET NULL,
    first_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    last_name VARCHAR(100) NOT NULL,
    birth_date DATE,
    sex sex_enum,
    contact_number VARCHAR(50),
    resident_type resident_type_enum,
    resident_status resident_status_enum DEFAULT 'Active',
    move_in_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE airbnb_host_properties (
    airbnb_property_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID NOT NULL UNIQUE REFERENCES properties(property_id) ON DELETE CASCADE,
    host_resident_id UUID NOT NULL REFERENCES resident_profiles(resident_id) ON DELETE CASCADE,
    listing_status VARCHAR(20) NOT NULL DEFAULT 'Active' CHECK (listing_status IN ('Active', 'Inactive')),
    max_guests INTEGER CHECK (max_guests IS NULL OR max_guests > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- MODULE C: Payment Monitoring
CREATE TABLE payment_types (
    payment_type_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    -- Historical payment records retain their type even after it is retired
    -- from the officer bill-generation list.
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    display_order SMALLINT NOT NULL DEFAULT 999
);

CREATE TABLE payments (
    payment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    resident_id UUID REFERENCES resident_profiles(resident_id) ON DELETE CASCADE,
    payment_type_id UUID REFERENCES payment_types(payment_type_id) ON DELETE SET NULL,
    billing_month DATE NOT NULL,
    amount_due DECIMAL(10, 2) NOT NULL,
    due_date DATE NOT NULL,
    payment_status payment_status_enum DEFAULT 'Pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE payment_transactions (
    transaction_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_id UUID REFERENCES payments(payment_id) ON DELETE CASCADE,
    amount_paid DECIMAL(10, 2) NOT NULL,
    payment_date DATE NOT NULL,
    proof_of_payment TEXT,
    approved_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    remarks TEXT
);

CREATE TABLE payment_receipts (
    receipt_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_id UUID REFERENCES payments(payment_id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Formal monthly assessment snapshots for the payment-policy engine. These
-- are audit records; they do not replace or overwrite original bills.
CREATE TABLE dues_policy_assessments (
    assessment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    resident_id UUID NOT NULL REFERENCES resident_profiles(resident_id) ON DELETE CASCADE,
    policy_date DATE NOT NULL,
    base_balance DECIMAL(10, 2) NOT NULL CHECK (base_balance >= 0),
    previous_cycle_balance DECIMAL(10, 2) NOT NULL CHECK (previous_cycle_balance >= 0),
    monthly_dues_added DECIMAL(10, 2) NOT NULL CHECK (monthly_dues_added >= 0),
    interest_amount DECIMAL(10, 2) NOT NULL CHECK (interest_amount >= 0),
    total_balance DECIMAL(10, 2) NOT NULL CHECK (total_balance >= 0),
    months_overdue SMALLINT NOT NULL CHECK (months_overdue >= 1),
    collection_stage VARCHAR(50) NOT NULL CHECK (
        collection_stage IN ('first_notice', 'second_notice', 'third_notice_hearing')
    ),
    requires_hearing BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (resident_id, policy_date)
);

-- MODULE D: Complaint Management
CREATE TABLE complaint_categories (
    category_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT
);

CREATE TABLE complaints (
    complaint_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    resident_id UUID REFERENCES resident_profiles(resident_id) ON DELETE CASCADE,
    category_id UUID REFERENCES complaint_categories(category_id) ON DELETE SET NULL,
    assigned_officer UUID REFERENCES users(user_id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    complaint_status complaint_status_enum DEFAULT 'Submitted',
    priority_level urgency_level_enum,
    priority_recommendation urgency_level_enum,
    priority_rule_code VARCHAR(100),
    priority_reason TEXT,
    priority_overridden_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    priority_overridden_at TIMESTAMP WITH TIME ZONE,
    priority_override_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE complaint_attachments (
    attachment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    complaint_id UUID REFERENCES complaints(complaint_id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE complaint_assignments (
    assignment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    complaint_id UUID REFERENCES complaints(complaint_id) ON DELETE CASCADE,
    officer_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    unassigned_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE complaint_updates (
    update_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    complaint_id UUID REFERENCES complaints(complaint_id) ON DELETE CASCADE,
    officer_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    status complaint_status_enum NOT NULL,
    remarks TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- MODULE E: Notifications
CREATE TABLE notifications (
    notification_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipient_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    notification_type notification_type_enum,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Durable audit log for the daily payment-reminder scheduler. The unique key
-- makes a delayed or repeated scheduler run safe and prevents duplicate notices.
CREATE TABLE payment_reminder_logs (
    reminder_log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_id UUID NOT NULL REFERENCES payments(payment_id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    reminder_stage VARCHAR(50) NOT NULL CHECK (
        reminder_stage IN (
            'courtesy_reminder',
            'final_reminder',
            'first_notice',
            'second_notice',
            'third_notice_hearing'
        )
    ),
    scheduled_for DATE NOT NULL,
    notification_id UUID NULL REFERENCES notifications(notification_id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (recipient_id, reminder_stage, scheduled_for)
);

CREATE INDEX idx_payment_reminder_logs_payment_id
    ON payment_reminder_logs(payment_id);

CREATE INDEX idx_payment_reminder_logs_recipient_schedule
    ON payment_reminder_logs(recipient_id, scheduled_for DESC);

-- MODULE F: Announcements
CREATE TABLE announcements (
    announcement_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    publish_date DATE,
    expiration_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- MODULE G: Resident Satisfaction
CREATE TABLE feedback (
    feedback_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    complaint_id UUID REFERENCES complaints(complaint_id) ON DELETE CASCADE,
    resident_id UUID REFERENCES resident_profiles(resident_id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- MODULE H: Reports & Audit
CREATE TABLE audit_logs (
    log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    module VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================
-- INDEXES FOR PERFORMANCE
-- ==============================================
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_resident_profiles_user_id ON resident_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_resident_profiles_property_id ON resident_profiles(property_id);
CREATE INDEX IF NOT EXISTS idx_properties_block_lot ON properties(block, lot);
CREATE INDEX IF NOT EXISTS idx_properties_property_use ON properties(property_use);
CREATE INDEX IF NOT EXISTS idx_airbnb_host_properties_host ON airbnb_host_properties(host_resident_id);
CREATE INDEX IF NOT EXISTS idx_payments_resident_id ON payments(resident_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(payment_status);
CREATE INDEX IF NOT EXISTS idx_dues_policy_assessments_resident_date ON dues_policy_assessments(resident_id, policy_date DESC);
CREATE INDEX IF NOT EXISTS idx_dues_policy_assessments_stage ON dues_policy_assessments(collection_stage, policy_date DESC);
CREATE INDEX IF NOT EXISTS idx_complaints_resident_id ON complaints(resident_id);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(complaint_status);
CREATE INDEX IF NOT EXISTS idx_complaints_priority ON complaints(priority_level);
CREATE INDEX IF NOT EXISTS idx_complaints_priority_recommendation ON complaints(priority_recommendation);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_id ON notifications(recipient_id);
