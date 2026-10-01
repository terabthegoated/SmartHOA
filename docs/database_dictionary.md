# SmartHOA Database Dictionary

## Overview
This document defines the tables and key fields within the SmartHOA database schema.

### 1. `users`
Stores system access credentials and core account status.

| Field | Type | Description |
|---|---|---|
| `user_id` | UUID (PK) | Unique identifier for the user. |
| `role_id` | UUID (FK) | Reference to `roles`. |
| `email` | VARCHAR | User's email address (UNIQUE). |
| `account_status` | ENUM | 'Active', 'Inactive', or 'Suspended'. |

### 2. `resident_profiles`
Stores the personal information of residents (Homeowners/Renters).

| Field | Type | Description |
|---|---|---|
| `resident_id` | UUID (PK) | Unique identifier for the profile. |
| `user_id` | UUID (FK) | 1:1 Reference to `users`. |
| `property_id` | UUID (FK) | Reference to `properties`. |
| `resident_type` | ENUM | 'Homeowner' or 'Renter'. |

### 3. `properties`
Represents physical addresses in the subdivision.

| Field | Type | Description |
|---|---|---|
| `property_id` | UUID (PK) | Unique identifier. |
| `block` | VARCHAR | Block number. |
| `lot` | VARCHAR | Lot number. |
| `property_status`| ENUM | 'Occupied' or 'Vacant'. |

### 4. `complaints`
Central table for tracking resident concerns.

| Field | Type | Description |
|---|---|---|
| `complaint_id` | UUID (PK) | Unique identifier. |
| `category_id` | UUID (FK) | Reference to `complaint_categories`. Selected by resident during submission. |
| `priority_level`| ENUM | 'Low', 'Medium', 'High', 'Critical'. Set by HOA Officer. |
| `complaint_status`| ENUM | 'Submitted', 'Assigned', 'In Progress', 'Resolved', 'Closed'. |

### 5. `complaint_assignments`
Tracks history of which officers handled a complaint.

| Field | Type | Description |
|---|---|---|
| `assignment_id` | UUID (PK) | Unique identifier. |
| `officer_id` | UUID (FK) | The officer assigned. |
| `is_active` | BOOLEAN | Whether this is the current assignment. |

### 6. `payments`
Tracks monthly dues and other fees.

| Field | Type | Description |
|---|---|---|
| `payment_id` | UUID (PK) | Unique identifier. |
| `amount_due` | DECIMAL | Total amount required. |
| `payment_status` | ENUM | 'Pending', 'Paid', 'Overdue'. |

### 7. `system_settings`
Key-Value store for dynamic system configuration.

| Field | Type | Description |
|---|---|---|
| `setting_key` | VARCHAR (UK)| E.g., 'monthly_hoa_fee'. |
| `setting_value` | TEXT | E.g., '1500.00'. |

*(Refer to `schema.sql` for the complete listing of all tables and all columns.)*
