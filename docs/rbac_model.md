# SmartHOA Role-Based Access Control (RBAC) Model

## Overview
This document defines the 4 core system roles for the SmartHOA platform, their specific permissions, dashboard configurations, and the backend authorization matrix. This ensures secure access control and data privacy.

---

## 1. System Roles

### 1.1 Super Administrator
* **Description**: The highest-level user responsible for system administration, configuration, and maintenance. They manage the platform itself, not the day-to-day HOA operations. (IT Administrator).
* **Key Permissions**:
  - **User Management**: Create, edit, deactivate users; Assign roles.
  - **System Settings**: Modify HOA fees, penalty rates, and system thresholds.
  - **Audit & Analytics**: View Audit Logs and Community Analytics.
  - **Global View**: Can view all Residents, Payments, and Complaints.

### 1.2 HOA Officer
* **Description**: The primary administrative user of the SmartHOA system. They handle the daily operations of the subdivision.
* **Key Permissions**:
  - **Payments**: Generate monthly dues, approve/reject payments, view history.
  - **Complaints**: View, assign, set priority, update, and close complaints.
  - **Communications**: Send notifications, create and edit announcements.
  - **Analytics**: View Community Analytics, DSS Recommendations, Export Reports.

### 1.3 Homeowner
* **Description**: A resident who legally owns a property within the subdivision.
* **Key Permissions**:
  - **Profile**: Edit personal information.
  - **Property**: View property ownership information.
  - **Payments**: View personal dues, upload payment receipts, view personal history.
  - **Complaints**: Submit complaints (select category), upload images, track status, provide feedback.
  - **Communications**: View announcements and receive notifications.

### 1.4 Renter
* **Description**: A resident who is currently renting a property within the subdivision.
* **Key Permissions**:
  - *Identical to Homeowner, with the following restrictions:*
  - Cannot view property ownership details.
  - Cannot manage property information.

---

## 2. Permission Matrix

| Module | Super Admin | HOA Officer | Homeowner | Renter |
|---|---|---|---|---|
| **Login / Dashboard** | ✅ | ✅ | ✅ | ✅ |
| **Manage Users & Roles** | ✅ | ❌ | ❌ | ❌ |
| **Manage Properties** | ✅ | ✅ | ❌ | ❌ |
| **View Residents** | All | All | Own Only | Own Only |
| **Manage Payments** | ✅ | ✅ | ❌ | ❌ |
| **Upload Payment Receipt**| ❌ | ❌ | ✅ | ✅ |
| **View Payment History** | All | All | Own Only | Own Only |
| **Submit Complaint** | ❌ | ❌ | ✅ | ✅ |
| **Manage Complaints** | ✅ | ✅ | ❌ | ❌ |
| **Set Complaint Priority**| ✅ | ✅ | ❌ | ❌ |
| **View Complaint Status** | All | All | Own Only | Own Only |
| **Complaint Attachments** | ✅ | ✅ | ✅ | ✅ |
| **Notifications** | ✅ | Send | Receive | Receive |
| **Announcements** | Manage | Manage | View | View |
| **Community Analytics** | ✅ | ✅ | ❌ | ❌ |
| **DSS Recommendations** | ✅ | ✅ | ❌ | ❌ |
| **Export Reports** | ✅ | ✅ | ❌ | ❌ |
| **System Settings/Audit** | ✅ | ❌ | ❌ | ❌ |

---

## 3. Dashboard Configurations per Role

### Super Administrator
- System Statistics (Total Users, Officers, Residents)
- System Settings shortcuts
- Audit Logs recent activity
- Global Analytics & Reports

### HOA Officer
- Pending Payments needing approval
- Complaint Queue (Sorted by Priority Level)
- Urgent Tickets
- DSS Recommendations & Community Analytics
- Recent Announcements

### Homeowner
- Outstanding Balance & Payment History
- My Complaints (Status tracking)
- Active Announcements
- Recent Notifications
- Feedback Requests

### Renter
- Assigned Payments
- My Complaints
- Active Announcements
- Recent Notifications

---

## 4. Backend Authorization Logic

Every backend API endpoint in the `backend/` folder will be secured by JWT middleware that explicitly checks the user's `role_id` against the required permissions before executing.

**Example: `POST /api/payments/generate`**
* **Allowed**: Super Administrator, HOA Officer
* **Denied**: Homeowner, Renter

**Example: `POST /api/complaints`**
* **Allowed**: Homeowner, Renter
* **Denied**: HOA Officer, Super Administrator (unless impersonating/testing)
