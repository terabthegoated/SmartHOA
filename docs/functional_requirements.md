# SmartHOA Functional Requirements & Use Cases

## Overview
This document outlines the 8 core modules of the SmartHOA system, detailing the specific functional requirements (FR) and use cases (UC) for each system actor.

---

## FR-01 Authentication
**Actors**: Super Administrator, HOA Officer, Homeowner, Renter

### Functional Requirements
* **FR-01.1**: The system shall allow users to log in using their registered email and password.
* **FR-01.2**: The system shall authenticate users before granting access.
* **FR-01.3**: The system shall redirect users to their respective dashboard based on their assigned role.
* **FR-01.4**: The system shall allow users to log out securely.
* **FR-01.5**: The system shall support password reset functionality.

### Use Cases
**UC-01 Login**  
`Open SmartHOA` ➔ `Enter Email` ➔ `Enter Password` ➔ `Authenticate` ➔ `Dashboard`

**UC-02 Logout**  
`Dashboard` ➔ `Logout` ➔ `Destroy Session` ➔ `Login Page`

---

## FR-02 User Management
**Actors**: Super Administrator

### Functional Requirements
* **FR-02.1**: Create user accounts.
* **FR-02.2**: Edit user accounts.
* **FR-02.3**: Deactivate accounts.
* **FR-02.4**: Assign user roles.
* **FR-02.5**: Reset user passwords.

### Use Cases
**UC-03 Manage Users**  
`Dashboard` ➔ `Users` ➔ `Create` ➔ `Assign Role` ➔ `Save`

---

## FR-03 Property & Resident Management
**Actors**: Super Administrator, HOA Officer, Homeowner (including Airbnb Host)

### Functional Requirements
* **FR-03.1**: Register property.
* **FR-03.2**: Assign homeowner.
* **FR-03.3**: Assign renter.
* **FR-03.4**: Update resident profile.
* **FR-03.5**: View resident information.
* **FR-03.6**: Designate a property as homeowner-occupied, renter-occupied, or Airbnb-hosted without registering temporary guests as permanent residents.

### Use Cases
**UC-04 Register Property**  
`New Property` ➔ `Enter Block` ➔ `Enter Lot` ➔ `Assign Resident` ➔ `Save`

**UC-04A Register Airbnb Host Property**  
`Homeowner Registration` ➔ `Select Airbnb Host Property` ➔ `Enter Block and Lot` ➔ `Save` ➔ `Officer Directory and Analytics`

---

## FR-04 Payment Monitoring
**Actors**: HOA Officer, Homeowner, Renter

### Functional Requirements
* **FR-04.1**: Generate monthly HOA dues.
* **FR-04.2**: View payment history.
* **FR-04.3**: Upload proof of payment.
* **FR-04.4**: Approve payments.
* **FR-04.5**: Reject payments.
* **FR-04.6**: Calculate overdue accounts.
* **FR-04.7**: Determine compliance level.

### Use Cases
**UC-05 Generate Monthly Dues (Officer)**  
`Dashboard` ➔ `Payments` ➔ `Generate Dues` ➔ `Residents Receive Notification`

**UC-06 Upload Payment Receipt (Resident)**  
`Dashboard` ➔ `Payments` ➔ `Upload Receipt` ➔ `Pending Approval`

**UC-07 Approve Payment (Officer)**  
`Pending Payments` ➔ `Review Receipt` ➔ `Approve` ➔ `Resident Notified`

---

## FR-05 Complaint Management
**Actors**: Homeowner, Renter, HOA Officer

### Functional Requirements
* **FR-05.1**: Submit complaint.
* **FR-05.2**: Upload complaint image.
* **FR-05.3**: Resident selects complaint category.
* **FR-05.4**: Officer assigns priority level.
* **FR-05.5**: Officer assigns complaint.
* **FR-05.6**: Officer updates complaint.
* **FR-05.7**: Resident tracks complaint.
* **FR-05.8**: Resident rates resolved complaint.

### Use Cases
**UC-08 Submit Complaint (Resident)**  
`Write Complaint` ➔ `Select Category` ➔ `Upload Image` ➔ `Submit` ➔ `Officer Queue`

**UC-09 Resolve Complaint (Officer)**  
`Review` ➔ `Set Priority` ➔ `Assign` ➔ `Resolve` ➔ `Resident Feedback`

---

## FR-06 Notifications & Announcements
**Actors**: HOA Officer, All Residents

### Functional Requirements
* **FR-06.1**: Send payment reminders.
* **FR-06.2**: Send complaint updates.
* **FR-06.3**: Publish announcements.
* **FR-06.4**: Notify overdue residents.
* **FR-06.5**: Display notification center.

### Use Cases
**UC-10 Publish Announcement (Officer)**  
`Create Announcement` ➔ `Publish` ➔ `Residents Receive Notification`

---

## FR-07 Community Analytics & DSS
**Actors**: HOA Officer, Super Administrator

### Functional Requirements
* **FR-07.1**: Display payment trends.
* **FR-07.2**: Display complaint statistics.
* **FR-07.3**: Display resident satisfaction.
* **FR-07.4**: Generate compliance metrics.
* **FR-07.5**: Provide decision-support insights.

### Use Cases
**UC-11 View Dashboard**  
`Dashboard` ➔ `Charts` ➔ `KPIs` ➔ `Recommendations`

**Dashboard KPIs include:**
- Monthly HOA revenue
- Outstanding dues
- Open vs. resolved complaints
- Average complaint resolution time
- Resident satisfaction rating
- Payment compliance rate
- High-priority complaint tickets

---

## FR-08 Reports & Audit Logs
**Actors**: Super Administrator, HOA Officer

### Functional Requirements
* **FR-08.1**: Export payment reports.
* **FR-08.2**: Export complaint reports.
* **FR-08.3**: Export analytics reports.
* **FR-08.4**: View audit logs.

### Use Cases
**UC-12 Export Report (Officer/Admin)**  
`Reports` ➔ `Select Type` ➔ `Generate PDF/CSV` ➔ `Download`

---

## Overall Use Case Diagram

```text
                           +--------------------------------------+
                           |             SmartHOA                 |
                           +--------------------------------------+

 Super Administrator
        |
        |-------------------- Login
        |-------------------- Manage Users
        |-------------------- Manage Roles
        |-------------------- Manage Properties
        |-------------------- View Analytics
        |-------------------- Configure System
        |-------------------- View Audit Logs
        |-------------------- Export Reports

 HOA Officer
        |
        |-------------------- Login
        |-------------------- Manage Payments
        |-------------------- Approve Payments
        |-------------------- Manage Complaints
        |-------------------- Assign Complaints
        |-------------------- Set Complaint Priority
        |-------------------- Post Announcements
        |-------------------- Send Notifications
        |-------------------- View Dashboard
        |-------------------- View DSS
        |-------------------- Export Reports

 Homeowner
        |
        |-------------------- Login
        |-------------------- View Dashboard
        |-------------------- View Payments
        |-------------------- Upload Payment Receipt
        |-------------------- Submit Complaint
        |-------------------- Select Complaint Category
        |-------------------- Track Complaint
        |-------------------- View Notifications
        |-------------------- Rate Complaint

 Renter
        |
        |-------------------- Login
        |-------------------- View Dashboard
        |-------------------- View Payments
        |-------------------- Upload Payment Receipt
        |-------------------- Submit Complaint
        |-------------------- Select Complaint Category
        |-------------------- Track Complaint
        |-------------------- View Notifications
```
