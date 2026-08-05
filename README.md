# 🩸 Bishop Heber College (Autonomous) – Emergency Blood Donor Network

An enterprise-grade, mobile-first Emergency Blood Request & NSS Student Donor Dispatch System built for **Bishop Heber College (Autonomous), Tiruchirappalli**.

This application allows patient relatives to scan hospital QR codes, submit verified emergency blood requests with Doctor Prescription proofs and GPS locations, and enables College NSS Coordinators to manage, review, and dispatch student donors in real time.

---

## 🌟 Key Features

### 📱 1. Mobile-First Public Blood Request Form (`/`)
- **Patient Relative QR Access**: Optimized for mobile screens (320px–480px) with one-column touch interface and sticky submission controls.
- **Native Camera & Gallery Access**: Direct label-wrapped inputs for iOS Safari & Android mobile camera captures.
- **GPS Location Detection**: High-accuracy browser geolocation with direct clickable Google Maps link generation.
- **Instant Non-Blocking Submission**: Saves requests to SQLite in **< 100ms** while sending confirmation emails asynchronously in the background.

### 🛡️ 2. College Administration & NSS Portal (`/admin`)
- **Real-Time Analytics Dashboard**: Filter requests by blood group, urgency, date/month/year, patient gender, and hospital.
- **Status Workflow**: Track requests through `PENDING`, `APPROVED`, `REQUEST_RECEIVED`, and `REJECTED`.
- **Audit Logging**: Every action logged with timestamp, actor role, and IP address.
- **Admin Password Reset (OTP)**: 6-digit verification code with 10-minute expiry and 60-second resend cooldown via Gmail SMTP.

### 📄 3. PDF Export, Direct Printing & Web Share API
- **1-Page A4 Printable Document**: Optimized `@media print` CSS layout guaranteeing single-page A4 PDF exports (`BHC_Blood_Request_<ID>.pdf`) without page breaks.
- **Independent PDF Actions**:
  - 📥 **Download PDF**: Client-side generation using `jsPDF` + `html2canvas` (does not open print dialog).
  - 🖨️ **Print PDF**: Direct browser print dialog (`window.print()`).
  - 📲 **Share Request**: Web Share API integration on mobile with WhatsApp text summary & high-resolution JPG card generation (`BHC_Blood_Request_Card_REQ-<ID>.jpg`).

### ✉️ 4. Real-Time Gmail SMTP Email Service
- **Nodemailer Integration**: Support for Google App Passwords (`smtp.gmail.com:465` SSL / `587` TLS) with fallback support for Brevo, Resend, and SendGrid APIs.
- **Automated Email Notifications**:
  - Admin Forgot Password OTPs.
  - Public Request relative confirmations.
  - Status updates (*Request Received* notifications to relatives).

---

## 🗄️ Database Architecture & Storage

### **SQLite Database (`backend/blood_bank.db`)**
The application uses SQLite3 with **WAL (Write-Ahead Logging)** mode enabled for concurrent read/write performance.

#### **Automated Schema Initialization (`backend/database.js`)**
On application startup (`node backend/server.js`), the backend automatically:
1. Enables foreign key constraints (`PRAGMA foreign_keys = ON;`).
2. Creates core tables if missing:
   - `blood_requests` (emergency blood request entries).
   - `hospitals` (registered Trichy hospitals).
   - `admins` (college administrators & NSS coordinators).
   - `audit_log` (audit trail of all administrative actions).
   - `colleges` & `student_verifications`.
3. Runs dynamic migrations (`addColumnIfNotExists`) to add new columns seamlessly without wiping existing data.
4. Seeds 12 default Tiruchirappalli Hospitals (e.g. *K.A.P. Viswanatham MGMGH, Apollo, Kauvery, BHC Medical Unit*) with unique registration IDs.
5. Dynamically registers new hospital records if a custom hospital is entered by a relative.

---

## 🚀 How to Deploy on Render

### **Step 1: Push Code to GitHub**
Ensure your code is pushed to your GitHub repository:
```bash
git add -A
git commit -m "Deploy BHC Blood Donor Network"
git push origin main
```

### **Step 2: Create Web Service on Render**
1. Log into **[Render Dashboard](https://dashboard.render.com)**.
2. Click **New +** → **Web Service**.
3. Connect your GitHub repository (`Ramsteyn450/bhc-blood-donor`).
4. Configure service settings:
   - **Name**: `bhc-blood-donor`
   - **Region**: Singapore (or nearest to your target users)
   - **Branch**: `main`
   - **Runtime**: `Node`
   - **Build Command**:
     ```bash
     npm install --prefix backend && npm install --include=dev --prefix frontend && npm run build --prefix frontend
     ```
   - **Start Command**:
     ```bash
     node backend/server.js
     ```

### **Step 3: Set Environment Variables**
In the Render **Environment** tab, add the following key-value pairs:

| Variable | Recommended Value / Example | Description |
|---|---|---|
| `PORT` | `10000` | Port assigned by Render |
| `NODE_ENV` | `production` | Production environment flag |
| `JWT_SECRET` | `bhc_blood_donor_secret_2026` | Secret key for JWT auth tokens |
| `FRONTEND_URL` | `https://bhc-blood-donor.onrender.com` | Production URL |
| `SMTP_HOST` | `smtp.gmail.com` | Google SMTP Host |
| `SMTP_PORT` | `465` | SSL Port for Gmail SMTP |
| `SMTP_SECURE` | `true` | Enable SSL |
| `SMTP_USER` | `bhcblooddonor@gmail.com` | Sender Gmail address |
| `SMTP_PASS` | `oxewleuhlwgfsvrd` | 16-character Google App Password |
| `EMAIL_FROM` | `"BHC Blood Donor Network" <bhcblooddonor@gmail.com>` | Verified email sender identity |

Click **Save Changes**. Render will automatically deploy your application!

---

## 🛠️ Local Development Setup

### **Prerequisites**
- Node.js `v18.0.0` or higher
- Git

### **Installation**
1. **Clone Repository**:
   ```bash
   git clone https://github.com/Ramsteyn450/bhc-blood-donor.git
   cd bhc-blood-donor
   ```

2. **Install All Dependencies**:
   ```bash
   npm run install-all
   ```

3. **Configure Environment File**:
   Create a `backend/.env` file:
   ```env
   PORT=5000
   JWT_SECRET=bhc_blood_donor_secret_2026
   FRONTEND_URL=http://localhost:3000

   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_SECURE=true
   SMTP_USER=bhcblooddonor@gmail.com
   SMTP_PASS=oxewleuhlwgfsvrd
   EMAIL_FROM="BHC Blood Donor Network" <bhcblooddonor@gmail.com>
   ```

4. **Build Frontend**:
   ```bash
   npm run build
   ```

5. **Start Application**:
   ```bash
   npm start
   ```
   - Open public form: `http://localhost:5000`
   - Open admin portal: `http://localhost:5000/admin`

---

## 🔑 Admin Portal Credentials (Default)

- **URL**: `/admin`
- **Email**: `cs255214307@bhc.edu.in` (or `admin@bhc.edu.in`)
- **Password**: `admin123`

---

## 📂 Project Structure

```text
c:/college blood pro/
├── backend/
│   ├── database.js            # SQLite connection, schema, WAL mode, migrations & seeding
│   ├── server.js              # Express API server, routes, JWT auth & static file serving
│   ├── services/
│   │   └── emailService.js    # Gmail SMTP & multi-provider real-time email dispatch
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── PublicRequestForm.jsx      # Patient relative mobile request form
│   │   │   ├── CollegeAdminDashboard.jsx  # NSS Admin review portal & analytics
│   │   │   ├── AdminForgotPassword.jsx    # OTP verification & password reset
│   │   │   ├── PdfDownloadModal.jsx       # 1-page A4 PDF download & Web Share API
│   │   │   └── PrintableRequestSheet.jsx  # Printable sheet container
│   │   ├── App.jsx                        # React Router routing
│   │   ├── index.css                      # Modern Tailwind CSS & A4 print media styles
│   │   └── main.jsx
│   └── package.json
├── render.yaml                # Render deployment configuration
├── package.json               # Root scripts & build manager
└── README.md                  # System Documentation
```

---

## 📄 License & Attribution

Developed for **Bishop Heber College (Autonomous), Tiruchirappalli, Tamil Nadu, India**.  
*Motto: "Nisi Dominus Frustra"*
