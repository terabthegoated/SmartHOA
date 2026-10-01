# SmartHOA

**A Web and Mobile-Based Decision Support and Community Analytics System for Southwynd Residences**

SmartHOA is a full-stack Progressive Web Application (PWA) designed to streamline homeowners' association operations for Southwynd Residences. It provides tools for payment monitoring, complaint management, community announcements, and data-driven decision support through analytics dashboards.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite (TypeScript) |
| Styling | Tailwind CSS |
| State Management | Zustand |
| Routing | React Router |
| Backend | PHP REST API |
| Authentication | JWT |
| Database | PostgreSQL (Supabase) |
| Charts | Recharts |
| PWA | Vite PWA Plugin |

## Features

- 🔐 **Role-Based Access Control** — Super Admin, HOA Officer, Homeowner, Renter
- 💳 **Payment Monitoring** — Monthly dues generation, receipt uploads, approval workflow
- 📋 **Complaint Management** — Submit, categorize, track, and resolve complaints
- 📊 **Community Analytics** — Revenue trends, complaint demographics, compliance metrics
- 🧠 **Decision Support System** — Rule-based insights and recommendations for officers
- 📢 **Announcements & Notifications** — Community-wide communication
- 📱 **PWA** — Installable, mobile-responsive, offline-capable
- 📄 **Report Generation** — Export analytics as PDF reports

## Getting Started

### Prerequisites
- Node.js 18+
- PHP 8.2+
- Composer
- PostgreSQL (Supabase account)

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Backend
```bash
cd backend
composer install
php -S localhost:8000
```

## Project Structure
```
SmartHOA/
├── frontend/    # React + Vite PWA
├── backend/     # PHP REST API
├── database/    # SQL schema & seeds
└── docs/        # Architecture, requirements, ERD
```

## License
© 2026 SmartHOA - Southwynd Residences. All rights reserved.
