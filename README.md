# Online Furniture Rental Portal (FurniRent)

A full-stack, responsive web application designed for renting premium home and office furniture with flexible rental durations, progressive tenure discounts, transparent security deposits, and an integrated administrator management portal.

---

## 🌟 Key Features

### 🛒 Customer Features
- **Curated Catalog Browsing**: Filter by categories (Living Room, Bedroom, Dining Room, Home Office, Storage & Decor).
- **Search & Sort**: Real-time keyword search, sorting by newest, monthly rate (low/high), and name.
- **Dynamic Tenure Calculator**: Test 3-month (5% OFF), 6-month (10% OFF), and 12-month (15% OFF) tenure discounts with instant price breakdowns.
- **Quick View Modal**: Interactive product preview with dimensions, materials, stock availability, and tenure simulator.
- **Cart & Flexible Tenure Drawer**: Add multiple items, select rental tenure for the order, and review refundable security deposits.
- **Seamless Checkout**: Address and contact form, delivery scheduling, simulated multi-payment options (Card, UPI, Net Banking, Pay on Delivery).
- **Order Tracking ("My Rentals")**: Real-time status progression bar (`Booked` → `Approved` → `Active / In-Use` → `Returned`), cancellation for pending bookings, and itemized invoice details.
- **1-Click Demo Login Bar**: Instant customer and admin logins for testing and grading.

### 🛡️ Administrator Features
- **Real-Time KPI Dashboard**:
  - Total Revenue collected
  - Active Subscriptions count & Monthly Recurring Revenue (MRR)
  - Pending Orders requiring review
  - Total Catalog Stock and units
  - Registered Customers count
- **Rental Order Management**: Filter orders by status, inspect customer details, and transition order statuses (`pending` → `approved` → `active` → `returned` / `cancelled`) with automatic inventory adjustments.
- **Inventory CRUD**:
  - Add new furniture items with category, rates, deposit, stock quantity, specs, and image URL
  - Edit existing furniture specifications
  - Delete catalog items
- **Customer Registry**: View registered users, contact info, total orders placed, and total spend.

---

## 🛠️ Tech Stack

- **Backend**: Node.js, Express.js
- **Database Engine**: Hybrid Dual-Storage Architecture (`mysql2` with automatic zero-config `better-sqlite3` fallback)
- **Authentication**: JWT (JSON Web Tokens) with `bcryptjs` password hashing
- **Frontend**: HTML5, Modern CSS3 Design System (Warm Scandinavian aesthetic, responsive grid), Vanilla JavaScript (ES6+)
- **Icons & Fonts**: FontAwesome 6, Google Fonts (Plus Jakarta Sans)

---

## 🚀 Quick Start

### 1. Installation
Navigate to the project root directory and ensure dependencies are installed:
```bash
cd furniture-rental-portal
npm install
```

### 2. Start the Server
```bash
npm start
```
The portal will launch at: **`http://localhost:5000`**

### 3. Database Notes
- **Zero-Config SQLite (Default)**: If MySQL is not running locally, the application automatically initializes and seeds an embedded SQLite database (`db/furniture_portal.sqlite`) with 10 furniture items, categories, and test accounts.
- **MySQL (Optional)**: To use MySQL, set your credentials in `.env` and run:
  ```bash
  npm run db:setup
  ```

---

## 👥 Demo User Credentials

| Role | Email | Password | Quick Action |
| :--- | :--- | :--- | :--- |
| **Customer** | `john@example.com` | `User@123` | Click **"Login as Customer (John Doe)"** in the top bar |
| **Admin** | `admin@rentalfurniture.com` | `Admin@123` | Click **"Login as Admin (Rental Admin)"** in the top bar |

---

## 📁 Project Structure

```
furniture-rental-portal/
├── .env                     # Environment variables (PORT, DB credentials, JWT secret)
├── package.json             # Dependencies & startup scripts
├── server.js                # Express app entrypoint & static file routing
├── test-portal.js           # Automated integration test suite
├── db/
│   ├── db.js                # Database connection & query helper (MySQL + SQLite)
│   ├── schema.sql           # MySQL DDL schema definitions
│   ├── setup.js             # MySQL setup & initial seeder script
│   └── furniture_portal.sqlite # Embedded SQLite database
├── middleware/
│   └── auth.js              # JWT verification & admin guard middleware
├── routes/
│   ├── auth.js              # Register, Login, and Profile endpoints
│   ├── categories.js        # Category retrieval endpoints
│   ├── furniture.js         # Furniture catalog & admin CRUD endpoints
│   ├── rentals.js           # Booking, tenure discount calculation & user rentals
│   └── admin.js             # Admin stats, order management & user registry
└── public/
    ├── index.html           # Single-page responsive application interface
    ├── css/
    │   └── style.css        # Design system, cards, modals, and responsive layout
    └── js/
        ├── app.js           # Core client app, cart state, checkout & tracking
        └── admin.js         # Admin dashboard, status switcher & inventory CRUD
```

---

## 🧪 Running Automated Tests

To run the automated verification script covering health checks, auth, catalog, booking, discounts, status transitions, and static assets:
```bash
node test-portal.js
```
