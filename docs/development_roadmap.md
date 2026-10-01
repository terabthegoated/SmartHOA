# SmartHOA Development Roadmap (Sprint-Based)

## Sprint 1 — Project Setup
* Set up the development environment.
* Scaffold `frontend/` (React + Vite, Tailwind CSS, Zustand, React Router).
* Scaffold `backend/` (PHP 8.2+, Composer, PDO, JWT).
* Initialize Supabase database with schema and seeds.

## Sprint 2 — Authentication
* Implement Login, Logout, Forgot Password.
* Set up JWT Authentication in PHP backend.
* Create Protected Routes and Role-Based Access Control in React.
* **Goal**: Be able to log in as Officer and reach a secure Dashboard.

## Sprint 3 — Resident Module
* Create Resident Dashboard.
* Edit Profile functionality.
* View Resident List (Admin/Officer).
* Property Assignment.

## Sprint 4 — Payment Monitoring
* **Officer**: Generate dues, update status, approve payments.
* **Resident**: View balance, upload receipt, view history.
* **Dashboard**: Compliance percentages.

## Sprint 5 — Complaint Module
* **Resident**: Submit Complaint (with images and category selection), track status.
* **Officer**: View Complaint queue, set priority level, assign officer, update resolution status.

## Sprint 6 — Notifications & Announcements
* Publish announcements (Officer).
* Receive notifications (Residents).
* Automated payment reminders and complaint updates.

## Sprint 7 — Community Analytics & Decision Support
* Render Charts (Revenue, Compliance, Complaint Categories, Resident Satisfaction).
* Implement rule-based Decision Support Insights (e.g., low collection rate triggers reminders).
* Build KPI dashboard with actionable recommendations.

## Sprint 8 — Reports & Exports
* Generate PDFs and CSVs for Payments, Complaints, and Analytics.

## Sprint 9 — PWA & Production
* Configure `manifest.json` and Service Workers for installability.
* Offline support caching.
* Security hardening and deployment.
