# 🦷 SmileCare Dental Clinic - Healthcare Portal & Management System

A modern, responsive, real-time Dental Clinic Web Application & Enterprise Healthcare Management System built with **HTML5**, **CSS3**, **Vanilla JavaScript (ES6+)**, and **[Supabase](https://supabase.com/)** (PostgreSQL Database, Auth, Storage, and Realtime Engine).

---

## 📋 Table of Contents

- [🌟 Project Overview](#-project-overview)
- [✨ Key Features & Web Portals](#-key-features--web-portals)
  - [1. 🏥 Public Clinic Website](#1-public-clinic-website)
  - [2. 📅 Patient Booking & Self-Service Portal](#2-patient-booking--self-service-portal)
  - [3. 🩺 Doctor Portal & Dashboard](#3-doctor-portal--dashboard)
  - [4. 👩‍⚕️ Staff / Receptionist Portal](#4-staff--receptionist-portal)
  - [5. 👑 Super Admin Portal](#5-super-admin-portal)
  - [6. 📄 Automated PDF Prescription & Receipt Engine](#6-automated-pdf-prescription--receipt-engine)
- [📁 Project Directory Structure](#-project-directory-structure)
- [🗄️ Database Architecture & Supabase Schema](#%EF%B8%8F-database-architecture--supabase-schema)
  - [Database Tables](#database-tables)
  - [Storage Bucket](#storage-bucket)
  - [Row Level Security (RLS) & Realtime Sync](#row-level-security-rls--realtime-sync)
- [⚙️ Setup & Configuration Guide](#%EF%B8%8F-setup--configuration-guide)
  - [Step 1: Database Setup](#step-1-database-setup)
  - [Step 2: API Keys Setup](#step-2-api-keys-setup)
  - [Step 3: Auth Users Creation](#step-3-auth-users-creation)
- [🌐 Local Testing](#-local-testing)
- [☁️ Deploying to Vercel](#%EF%B8%8F-deploying-to-vercel)
- [📝 License](#-license)

---

## 🌟 Project Overview

**SmileCare Dental Clinic System** provides a seamless digital experience for dental patients, clinic doctors, reception staff, and clinic owners. The platform handles everything from online appointment booking with real-time slot conflict prevention to prescription generation, doctor leave management, patient record lookups, and clinic performance analytics.

---

## ✨ Key Features & Web Portals

### 1. 🏥 Public Clinic Website
- **Landing Page (`home.html` & `index.html`)**: Dynamic hero sections, interactive treatment cards, doctor showcases, stats counter, and patient reviews.
- **Treatments Page (`treatments.html`)**: Comprehensive details on Root Canal, Orthodontics, Dental Implants, Teeth Whitening, Crowns & Bridges, and Pediatric Care.
- **Our Doctors Directory (`our-doctors.html`)**: Full doctor profiles with qualifications, specializations, and direct booking links.
- **About Us & Why Us (`about-clinic.html`, `why-us.html`)**: Clinic philosophy, hygiene standards, high-tech dental machinery, and emergency services.
- **Patient Testimonials (`testimonials.html`)**: Patient ratings, reviews, and treatment transformation showcases.

---

### 2. 📅 Patient Booking & Self-Service Portal

#### **Patient Booking System (`index.html` & `js/booking.js`)**
- **Dynamic Doctor Selection**: Doctor dropdown automatically pulled from Supabase DB with active specializations.
- **Smart Slot Picker**: 15-minute time slots dynamically generated based on doctor working hours and leave calendar.
- **Conflict Prevention**: Instantly checks locked/booked slots to prevent double-booking.
- **Leave & Holiday Guard**: Automatically disables dates when a doctor is marked on leave.
- **File Upload Support**: Patients can attach medical records, previous prescriptions, or X-rays during booking (uploaded directly to Supabase Storage).

#### **Patient History Portal (`my-appointments.html` & `js/my-appointments.js`)**
- **Mobile Number Lookup**: View past and upcoming appointments by entering a 10-digit mobile number.
- **Real-Time Status Tracking**: Live updates when appointment status changes (`Pending` ➔ `Confirmed` ➔ `Completed` / `Cancelled`).
- **Reschedule & Cancel Modals**: Easily change appointment date/time or cancel with reason selection.
- **Prescription & Medical Report Downloads**: View doctor diagnoses, medicine notes, and download official medical PDF reports.

---

### 3. 🩺 Doctor Portal & Dashboard (`doctors.html` & `js/dashboard.js`)
- **Secure Authentication**: Doctor login powered by Supabase Auth (`signInWithPassword`).
- **Personalized Appointment Queue**: View today's, upcoming, and past patient bookings filtered specifically for the logged-in doctor.
- **Prescription & Diagnosis Writer**:
  - Add medical diagnosis and detailed medicine schedules.
  - Set recommended follow-up visit dates.
  - Upload multiple doctor reports/X-rays stored in JSON format (`doctor_reports`).
- **Schedule & Leave Management**:
  - Toggle weekly day-of-week working status and working hours.
  - Mark single-day or multi-day emergency leave dates with reason notes.
- **Single-Click Actions**: Quick status updates (Confirm, Complete, Cancel appointment).

---

### 4. 👩‍⚕️ Staff / Receptionist Portal (`staff.html` & `js/staff.js`)
- **Front-Desk Management**: Dedicated interface for receptionists and clinic nurses.
- **Walk-in Check-in**: Quick search by patient name or phone number.
- **Document Attachment Assistant**: Upload patient reports, billing receipts, or lab tests on behalf of patients.
- **Appointment Queue Supervision**: Mark patients as arrived, in-consultation, or completed.

---

### 5. 👑 Super Admin Portal (`admin.html` & `js/admin.js`)
- **Total Clinic Control Panel**:
  - **Doctors Directory Management**: Add new doctors, update credentials/specializations, link auth emails, or remove accounts.
  - **Staff Management**: Add and manage receptionist/nurse user roles (`Admin` or `Receptionist`).
  - **Appointment Master Control**: View all clinic bookings, reassign assigned doctors, edit dates/slots, or delete entries.
- **Analytics & Executive Dashboard**:
  - Total Bookings counter.
  - Today's Appointments overview.
  - Status distribution metrics (Confirmed vs Pending vs Completed vs Cancelled).
  - Doctor workload and performance statistics.

---

### 6. 📄 Automated PDF Prescription & Receipt Engine (`js/pdf-generator.js`)
- Instant PDF document creation using `html2pdf.js`.
- Features official clinic branding, doctor signature headers, patient metadata, formatted diagnosis notes, prescription medicine tables, and next visit recommendations.

---

## 📁 Project Directory Structure

```text
dental/
├── index.html                 # Main Patient Booking & Slot Selection Page
├── home.html                  # Main Clinic Homepage & Marketing Showcase
├── about-clinic.html          # Clinic History, Equipment & Tech Information
├── treatments.html            # Detailed Dental Services & Procedures Guide
├── our-doctors.html           # Doctor Credentials & Profiles Directory
├── why-us.html                # Clinic Advantages & Safety Protocols
├── testimonials.html          # Patient Reviews & Case Gallery
├── my-appointments.html       # Patient Appointment Search & History Portal
├── doctors.html               # Doctor Dashboard & Prescription Management
├── staff.html                 # Staff / Receptionist Front-Desk Operations Portal
├── admin.html                 # Super Admin Management Portal & Analytics
├── css/
│   └── style.css              # Unified Enterprise CSS Design System (Glassmorphism & Light Theme)
├── js/
│   ├── config.js              # Supabase Client Init, Global Helpers, Toast System, Time Formatters
│   ├── booking.js             # Patient Booking Form Logic, Slot Picker & Conflict Lock Engine
│   ├── home.js                # Landing Page Interactivity, FAQs & Hero Counters
│   ├── my-appointments.js     # Patient Search, Reschedule, Cancel & Report Viewers
│   ├── dashboard.js           # Doctor Portal Auth, Prescription Form, Leave Management & Status Controls
│   ├── staff.js               # Receptionist Operations, Document Upload & Patient Queue
│   ├── admin.js               # Admin Analytics, Doctor/Staff CRUD & Master Appointment Controls
│   └── pdf-generator.js       # Client-Side PDF Generation for Medical Prescriptions & Slips
├── assets/                    # SVG Icons, Logos, Hero Graphics & Doctor Photographs
├── database/
│   └── schema.sql             # SQL Migration File (Tables, RLS Policies, Buckets & Realtime Setup)
└── README.md                  # Comprehensive Documentation & Setup Guide
```

---

## 🗄️ Database Architecture & Supabase Schema

The database is built on **PostgreSQL** inside Supabase. Complete SQL schema definitions are located in [`database/schema.sql`](file:///d:/dental/database/schema.sql).

### Database Tables

1. **`doctors`**
   - `id` (UUID, Primary Key)
   - `name` (TEXT)
   - `specialization` (TEXT)
   - `email` (TEXT, Unique)
   - `created_at` (TIMESTAMPTZ)

2. **`appointments`**
   - `id` (BIGINT, Primary Key)
   - `patient_name` (TEXT), `age` (INT), `gender` (TEXT), `email` (TEXT), `mobile` (TEXT)
   - `issue` (TEXT) - Patient complaint details
   - `document_url` (TEXT) - Attached file URL from patient upload
   - `doctor_report_url` (TEXT) - Primary doctor uploaded file
   - `doctor_reports` (JSONB) - Array of doctor uploads: `[{"name": "X-Ray", "url": "https://..."}]`
   - `diagnosis` (TEXT), `medicine` (TEXT), `next_visit_date` (DATE)
   - `cancellation_reason` (TEXT)
   - `appointment_date` (DATE), `appointment_time` (TEXT)
   - `doctor_id` (UUID, Foreign Key referencing `doctors.id`)
   - `status` (TEXT) - `Pending`, `Confirmed`, `Completed`, `Cancelled`
   - `created_at` (TIMESTAMPTZ)

3. **`doctor_availability`**
   - Stores weekly schedule (Monday-Sunday, start time, end time, availability status).

4. **`doctor_leaves`**
   - Stores specific date leaves requested by doctors to block bookings on those dates.

5. **`staff`**
   - Stores clinic staff user accounts (`Admin`, `Receptionist`) for authentication and access control.

---

### Storage Bucket

- **`patient-documents`**: Public storage bucket configured for patient attachment files, medical prescriptions, and doctor reports.

---

### Row Level Security (RLS) & Realtime Sync

- **RLS Enabled**: Policies grant appropriate read/write/update access for public bookings, patient searches, doctor actions, staff controls, and admin management.
- **Supabase Realtime**: Replication is active for `appointments`, `doctors`, `doctor_availability`, `doctor_leaves`, and `staff` tables using PostgreSQL publications (`supabase_realtime`).

---

## ⚙️ Setup & Configuration Guide

### Step 1: Database Setup
1. Log into your [Supabase Dashboard](https://supabase.com/dashboard).
2. Open the **SQL Editor** tab.
3. Open [`database/schema.sql`](file:///d:/dental/database/schema.sql), copy all lines, paste them into the SQL Editor, and click **Run**.
4. This script automatically creates all required tables, indexes, storage buckets, RLS policies, and enables Supabase Realtime.

---

### Step 2: API Keys Setup
Open [`js/config.js`](file:///d:/dental/js/config.js) and update `SUPABASE_URL` and `SUPABASE_ANON_KEY` with your project keys found in **Project Settings -> API** in Supabase:

```javascript
const SUPABASE_URL = "https://YOUR-SUPABASE-PROJECT-ID.supabase.co";
const SUPABASE_ANON_KEY = "YOUR-SUPABASE-ANON-KEY";
```

---

### Step 3: Auth Users Creation

#### **Doctor Accounts**
1. Go to **Authentication -> Users** in Supabase.
2. Click **Add User** -> **Create User**.
3. Create accounts using the doctor email addresses defined in the `doctors` table (e.g. `priya123@clinic.com`, `rahul@clinic.com`).

#### **Admin & Staff Accounts**
1. Create user accounts in **Authentication -> Users** with emails present in the `staff` table (e.g. `admin@smilecare.com`, `staff@smilecare.com`).

---

## 🌐 Local Testing

You can run and test the web app using any local static file server:

- **Using VS Code Live Server**: Right-click `index.html` or `home.html` and click **Open with Live Server**.
- **Using Python HTTP Server**:
  ```bash
  python -m http.server 3000
  ```
  Then visit `http://localhost:3000` in your web browser.

---

## ☁️ Deploying to Vercel

1. Push your project to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Deploy SmileCare Dental Clinic Web Portal"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/smilecare-dental-clinic.git
   git push -u origin main
   ```
2. Go to [Vercel Dashboard](https://vercel.com).
3. Click **Add New** -> **Project**.
4. Import your GitHub repository (`smilecare-dental-clinic`).
5. Select **Framework Preset**: `Other`, **Root Directory**: `./`.
6. Click **Deploy**.

Vercel will build and host your clinic website globally on HTTPS in seconds!

---

## 📝 License

© 2026 **SmileCare Dental Clinic**. All Rights Reserved.

