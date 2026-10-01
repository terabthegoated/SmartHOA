# SmartHOA UI/UX Design & Frontend Architecture (Version 1.1)

## 1. Design Goals & Brand Personality
The UI is designed to give a **warm, residential, and premium feel**, reflecting the identity of a community (like Southwynd Residences) rather than cold corporate banking software.
* **Brand Keywords**: Community, Trust, Warm, Reliable, Modern.
* **Aesthetics**: Clean, minimalist, and breathable. Keep brown reserved for key actions/navigation, letting the cream background provide a modern, elegant breathing room.
* **Mobile Responsiveness (PWA)**: Installable, fast, offline-friendly.

## 2. Color Palette
A custom Brown & Cream theme providing a unique identity for SmartHOA.

| Function | Color | Hex Code | Usage |
|---|---|---|---|
| **Primary Brown**| Brown | `#6F4E37` | Primary buttons, Sidebar, Logo, Icons, Active Nav |
| **Dark Brown** | Dark Brown | `#4B352A` | Headings, Important text, Nav hover |
| **Cream White** | Background | `#F8F4EC` | Main app background, Cards section background |
| **White** | Surface | `#FFFFFF` | Cards, Forms, Tables, Modals |
| **Accent Gold** | Gold | `#D4A373` | Highlights, Active indicators, Premium accents |
| **Text** | Dark Gray | `#2D2A26` | Body text |
| **Success** | Green | `#4CAF50` | Paid status, Completed actions |
| **Warning** | Amber | `#F59E0B` | Pending status, Warnings |
| **Danger** | Red | `#DC2626` | Overdue status, Critical complaints, Errors |

## 3. Typography
* **Headings**: `Poppins SemiBold`
* **Body**: `Inter Regular`

## 4. UI Components

### Buttons
* **Primary**: Brown background, White text, Rounded corners (12px).
* **Secondary**: White background, Brown border, Brown text.
* **Danger**: Red background, White text.

### Cards
* **Style**: White `#FFFFFF` surface standing out cleanly against the Cream White `#F8F4EC` background. Minimalist shadow.

### Icons & Logo
* **Icons**: `lucide-react` using Primary Brown.
* **Logo**: House (Community) + Shield (Security) in a Circular border (Unity) using Brown & Accent Gold.

### Charts
* Revenue: Brown
* Complaints: Accent Gold
* Paid: Green
* Overdue: Red
* Pending: Amber

## 5. Layout Structure
**Desktop Layout**:
* Top Navbar (User profile, notifications)
* Left Sidebar (Dark Brown background)
* Center Main Content area (Cream White background)

**Mobile Layout (PWA)**:
* Top Navbar
* Main Content
* Bottom Navigation Menu

## 6. Frontend Folder Structure
```text
frontend/src/
├── assets/
├── components/
│   ├── common/
│   ├── layout/
│   ├── dashboard/
│   ├── payments/
│   ├── complaints/
│   ├── notifications/
│   └── analytics/
├── pages/
│   ├── auth/
│   ├── admin/
│   ├── officer/
│   ├── homeowner/
│   └── renter/
├── services/
├── hooks/
├── store/
├── utils/
├── routes/
├── contexts/
└── styles/
```
