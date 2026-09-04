# 🦷 SmileCare Dental Clinic - Booking & Management System

A modern, responsive, real-time Dental Clinic Booking and Management Web Application built with HTML, CSS, JavaScript, and [Supabase](https://supabase.com/).

---

## 🚀 Features

1. **Patient Booking System (`index.html`)**
   - Doctor selection dropdown dynamically loaded from database.
   - Live 15-minute time slot selection (9:00 AM to 5:00 PM).
   - Real-time slot locking and instant conflict prevention.
   - Clean validation for Patient Name, Age, Gender, and 10-digit Mobile Number.

2. **Patient Appointment Portal (`my-appointments.html`)**
   - Search booking history by patient mobile number.
   - Real-time updates when appointment status changes (Pending, Confirmed, Cancelled, Completed).
   - Instant Cancel Appointment & Reschedule Date/Time Slot modal dialogs.

3. **Doctor Portal & Dashboard (`dashboard.html`)**
   - Secure Doctor authentication powered by Supabase Auth (`signInWithPassword`).
   - Doctor profile lookup showing doctor avatar, name, and specialization.
   - Complete appointments table filtered per logged-in doctor.
   - Filter by date, status, or patient search term.
   - Single-click appointment status actions (Confirm, Complete, Cancel).
   - Clean logout workflow with session reset and automatic input clearing.

4. **Realtime Sync**
   - Supabase Realtime enabled (`postgres_changes`) for instantaneous updates across patient & doctor screens without page refreshes.

---

## 📁 Project Structure

```
dental-clinic-deploy/
├── index.html                 # Main Patient Booking Page
├── dashboard.html             # Doctor Portal & Management Dashboard
├── my-appointments.html       # Patient Appointment Search & Actions
├── css/
│   └── style.css              # Universal UI/UX Design System Stylesheet
├── js/
│   ├── config.js              # Supabase Credentials & Client Initialization
│   ├── booking.js             # Booking Form Logic & Realtime Slot Picker
│   ├── dashboard.js           # Doctor Auth & Management Dashboard Logic
│   └── my-appointments.js     # Patient Search & Cancel/Reschedule Logic
├── assets/
│   ├── logo-full.svg          # Clinic Full Logo Asset
│   └── logo-icon.svg          # Clinic Icon Asset
├── database/
│   └── schema.sql             # Complete Supabase SQL Table Schema & Seed Data
└── README.md                  # Project Documentation & Vercel Deployment Guide
```

---

## ⚙️ Setup & Configuration

### 1. Supabase Database Setup
1. Log into your [Supabase Console](https://supabase.com/dashboard).
2. Create a new project or select your existing project.
3. Open the **SQL Editor** tab.
4. Copy all SQL code from `database/schema.sql` and run it. This will create:
   - `doctors` table
   - `appointments` table
   - Enable Realtime replication for `appointments`
5. Go to **Authentication -> Users** in Supabase:
   - Create user accounts for doctors matching their email addresses in the `doctors` table (e.g. `priya123@clinic.com`, `rahul@clinic.com`).

### 2. Add API Keys to `js/config.js`
Open `js/config.js` and replace the placeholder values with your project credentials from **Project Settings -> API** in Supabase:

```javascript
const SUPABASE_URL = 'https://YOUR-SUPABASE-PROJECT-ID.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR-SUPABASE-ANON-KEY';
```

---

## 🌐 Local Testing

You can test the website locally before deploying:
- Using **VS Code Live Server**: Right-click `index.html` and select **Open with Live Server**.
- Using **Python HTTP Server**:
  ```bash
  python -m http.server 3000
  ```
  Then open `http://localhost:3000` in your browser.

---

## ☁️ Deploying to Vercel

Follow these steps to deploy your website live on Vercel:

### Step 1: Upload to GitHub
1. Initialize Git in the `dental-clinic-deploy` folder:
   ```bash
   git init
   git add .
   git commit -m "Initial commit - Dental Clinic Deploy"
   ```
2. Create a new repository on GitHub (e.g. `dental-clinic-website`).
3. Push your code to GitHub:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/dental-clinic-website.git
   git branch -M main
   git push -u origin main
   ```

### Step 2: Deploy on Vercel
1. Log into your [Vercel Dashboard](https://vercel.com).
2. Click **Add New...** -> **Project**.
3. Import your GitHub repository (`dental-clinic-website`).
4. Keep the default settings (Framework Preset: **Other**, Root Directory: `./`).
5. Click **Deploy**.

Vercel will deploy your project in seconds and provide a live URL (e.g. `https://dental-clinic-website.vercel.app`).

---

## 📝 License
© 2026 SmileCare Dental Clinic. All Rights Reserved.
