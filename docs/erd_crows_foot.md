# SmartHOA Professional ERD (Crow's Foot Notation)

This Entity-Relationship Diagram utilizes Crow's Foot notation to represent the exact PostgreSQL schema and cardinality rules within the SmartHOA system.

```mermaid
erDiagram
    SYSTEM_SETTINGS {
        UUID setting_id PK
        VARCHAR setting_key UK
        TEXT setting_value
    }
    
    ROLES ||--o{ USERS : "assigned to"
    ROLES {
        UUID role_id PK
        VARCHAR role_name UK
    }

    USERS ||--o| RESIDENT_PROFILES : "has profile"
    USERS ||--o{ COMPLAINT_ASSIGNMENTS : "assigned as officer"
    USERS ||--o{ AUDIT_LOGS : "generates"
    USERS ||--o{ NOTIFICATIONS : "receives"
    USERS ||--o{ PAYMENT_TRANSACTIONS : "approves"
    USERS ||--o{ ANNOUNCEMENTS : "creates"
    USERS {
        UUID user_id PK
        UUID role_id FK
        VARCHAR email UK
        TEXT password_hash
    }

    PROPERTIES ||--o{ RESIDENT_PROFILES : "houses"
    PROPERTIES {
        UUID property_id PK
        VARCHAR block
        VARCHAR lot
    }

    RESIDENT_PROFILES ||--o{ PAYMENTS : "billed for"
    RESIDENT_PROFILES ||--o{ COMPLAINTS : "files"
    RESIDENT_PROFILES ||--o{ FEEDBACK : "gives"
    RESIDENT_PROFILES {
        UUID resident_id PK
        UUID user_id FK
        UUID property_id FK
        VARCHAR first_name
        VARCHAR last_name
    }

    PAYMENT_TYPES ||--o{ PAYMENTS : "categorizes"
    PAYMENT_TYPES {
        UUID payment_type_id PK
        VARCHAR payment_name UK
    }

    PAYMENTS ||--o{ PAYMENT_TRANSACTIONS : "contains"
    PAYMENTS ||--o{ PAYMENT_RECEIPTS : "has attachments"
    PAYMENTS {
        UUID payment_id PK
        UUID resident_id FK
        UUID payment_type_id FK
        DECIMAL amount_due
        ENUM payment_status
    }

    COMPLAINT_CATEGORIES ||--o{ COMPLAINTS : "categorizes"
    COMPLAINT_CATEGORIES {
        UUID category_id PK
        VARCHAR category_name UK
    }

    COMPLAINTS ||--o{ COMPLAINT_UPDATES : "tracked by"
    COMPLAINTS ||--o{ COMPLAINT_ATTACHMENTS : "has images"
    COMPLAINTS ||--o{ COMPLAINT_ASSIGNMENTS : "assigned via"
    COMPLAINTS ||--o| FEEDBACK : "rated in"
    COMPLAINTS {
        UUID complaint_id PK
        UUID resident_id FK
        UUID category_id FK
        UUID assigned_officer FK
        VARCHAR title
        ENUM complaint_status
        ENUM priority_level
    }

    FEEDBACK {
        UUID feedback_id PK
        UUID complaint_id FK
        UUID resident_id FK
        INTEGER rating
    }

    NOTIFICATIONS {
        UUID notification_id PK
        UUID recipient_id FK
        VARCHAR title
    }

    ANNOUNCEMENTS {
        UUID announcement_id PK
        UUID created_by FK
        VARCHAR title
    }

    AUDIT_LOGS {
        UUID log_id PK
        UUID user_id FK
        TEXT action
    }
```
