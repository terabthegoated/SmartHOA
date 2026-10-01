-- Non-destructive Airbnb host/property support.
-- Existing homeowners, renters, properties, and payments are retained.

ALTER TABLE properties
    ADD COLUMN IF NOT EXISTS property_use VARCHAR(20) NOT NULL DEFAULT 'Homeowner';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_properties_property_use'
    ) THEN
        ALTER TABLE properties
            ADD CONSTRAINT chk_properties_property_use
            CHECK (property_use IN ('Homeowner', 'Renter', 'Airbnb'));
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS airbnb_host_properties (
    airbnb_property_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID NOT NULL UNIQUE REFERENCES properties(property_id) ON DELETE CASCADE,
    host_resident_id UUID NOT NULL REFERENCES resident_profiles(resident_id) ON DELETE CASCADE,
    listing_status VARCHAR(20) NOT NULL DEFAULT 'Active'
        CHECK (listing_status IN ('Active', 'Inactive')),
    max_guests INTEGER CHECK (max_guests IS NULL OR max_guests > 0),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_properties_property_use ON properties(property_use);
CREATE INDEX IF NOT EXISTS idx_airbnb_host_properties_host ON airbnb_host_properties(host_resident_id);

COMMENT ON TABLE airbnb_host_properties IS
    'Property-level Airbnb host records. Short-term guests are not stored as permanent HOA residents.';
