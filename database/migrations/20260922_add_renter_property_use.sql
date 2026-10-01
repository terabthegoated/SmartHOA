-- Extend the property-registration choices without changing resident records.
ALTER TABLE properties DROP CONSTRAINT IF EXISTS chk_properties_property_use;

ALTER TABLE properties
    ADD CONSTRAINT chk_properties_property_use
    CHECK (property_use IN ('Homeowner', 'Renter', 'Airbnb'));
