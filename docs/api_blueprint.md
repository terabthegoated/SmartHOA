# SmartHOA API Blueprint

## Authentication Endpoints
| Method | Endpoint | Description | Payload Example |
|---|---|---|---|
| POST | `/api/auth/login` | Authenticates user and returns JWT | `{ "email": "user@test.com", "password": "123" }` |
| POST | `/api/auth/register` | Registers a new homeowner/renter | `{ "email": "...", "password": "...", "role_name": "Homeowner" }` |
| POST | `/api/auth/logout` | Invalidates user session/token | `{}` |
| GET | `/api/auth/me` | Fetches currently logged-in user profile | `None` |

## Dashboard & Analytics Endpoints
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/dashboard/stats` | Returns high-level KPIs (total collections, open complaints) |
| GET | `/api/dashboard/officer` | Returns data specifically for the officer dashboard view |

## Payment Endpoints
| Method | Endpoint | Description | Payload Example |
|---|---|---|---|
| GET | `/api/payments` | Retrieves all payments (filtered by resident if non-admin) | `None` |
| POST | `/api/payments` | Creates a new payment record (Officers only) | `{ "resident_id": "...", "amount_due": 1500, "due_date": "..." }` |
| POST | `/api/payments/{id}/pay` | Submits payment receipt for a specific payment | `FormData (file, amount)` |
| PUT | `/api/payments/{id}/approve` | Officer approves a submitted payment | `{ "remarks": "Approved" }` |

## Complaint Endpoints
| Method | Endpoint | Description | Payload Example |
|---|---|---|---|
| GET | `/api/complaints` | Retrieves complaints list | `None` |
| POST | `/api/complaints` | Resident submits a new complaint | `FormData (title, description, file)` |
| GET | `/api/complaints/{id}` | Retrieves detailed complaint data including updates | `None` |
| POST | `/api/complaints/{id}/assign` | Assigns an officer to a complaint | `{ "officer_id": "UUID" }` |
| POST | `/api/complaints/{id}/update` | Officer updates complaint status | `{ "status": "In Progress", "remarks": "..." }` |

## Notification Endpoints
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/notifications` | Retrieves user's notifications |
| POST | `/api/notifications` | Triggers a manual notification (Admin/Officer) |
| PUT | `/api/notifications/{id}/read` | Marks a notification as read |

## System Endpoints
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/settings` | Retrieves global system settings |
| PUT | `/api/settings` | Updates global system settings (Admin only) |
| GET | `/api/categories` | Retrieves all complaint categories |
