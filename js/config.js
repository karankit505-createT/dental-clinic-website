// ==========================================
// SUPABASE CONFIGURATION FILE
// ==========================================
// Replace the placeholder values below with your actual Supabase URL and Anon Key.
// You can find these in your Supabase Dashboard under: Project Settings -> API

const SUPABASE_URL = "https://zachsbcilzegjyrseehu.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Q9uJ9RYVX2QhEtS9OCCLAQ_NvLTbreh";

// Check if Supabase keys have been configured by the user
function isSupabaseConfigured() {
    return (
        SUPABASE_URL &&
        SUPABASE_ANON_KEY &&
        !SUPABASE_URL.includes("PASTE_YOUR_") &&
        !SUPABASE_ANON_KEY.includes("PASTE_YOUR_")
    );
}

// Initialize Supabase Client using CDN library
let supabaseClient = null;

if (window.supabase) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} else {
    console.error("Supabase JS library is not loaded. Make sure script CDN is included.");
}

// Global Toast Notification Helper
function showToast(message, type = "info", duration = 3500) {
    let container = document.getElementById("toastContainer");
    if (!container) {
        container = document.createElement("div");
        container.id = "toastContainer";
        document.body.appendChild(container);
    }

    // Clear previous toasts so only one active toast is shown at a time
    container.innerHTML = "";

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;

    let icon = "ℹ️";
    if (type === "success") icon = "✓";
    if (type === "error") icon = "✕";
    if (type === "warning") icon = "⚠️";

    toast.innerHTML = `<span class="toast-icon">${icon}</span><div>${message}</div>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add("toast-fade-out");
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, duration);
}

// Global 12-Hour Time Formatter (e.g. "18:00:00" -> "06:00 PM", "11:30:00" -> "11:30 AM")
function formatTime12Hour(timeStr) {
    if (!timeStr || timeStr === "-") return "-";
    timeStr = String(timeStr).trim();

    // If it already contains AM or PM, return as is
    if (/AM|PM/i.test(timeStr)) {
        return timeStr;
    }

    // Match HH:MM or HH:MM:SS
    const match = timeStr.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (match) {
        let hours = parseInt(match[1], 10);
        const minutes = match[2];
        const period = hours >= 12 ? "PM" : "AM";

        if (hours === 0) {
            hours = 12;
        } else if (hours > 12) {
            hours -= 12;
        }

        const hoursStr = hours < 10 ? "0" + hours : "" + hours;
        return `${hoursStr}:${minutes} ${period}`;
    }

    return timeStr;
}

// Global HTML Escaper
function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Global Helper to format report date nicely (e.g. "15 June 2026")
function formatReportDate(dateVal) {
    if (!dateVal || dateVal === "Date not recorded" || dateVal === "null" || dateVal === "undefined") {
        return "Date not recorded";
    }

    let str = String(dateVal).trim();
    if (!str) return "Date not recorded";

    let d = null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
        d = new Date(str + "T00:00:00");
    } else {
        d = new Date(str);
    }

    if (d && !isNaN(d.getTime())) {
        return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    }

    return str || "Date not recorded";
}

// Global Helper to retrieve normalized array of doctor reports [{ name, url, report_date, upload_date, created_at }]
function getAppointmentReports(item) {
    if (!item) return [];
    let reports = [];

    // 1. Try parsing doctor_reports column (JSONB / JSON array)
    if (item.doctor_reports) {
        try {
            const parsed = typeof item.doctor_reports === 'string' 
                ? JSON.parse(item.doctor_reports) 
                : item.doctor_reports;
            if (Array.isArray(parsed) && parsed.length > 0) {
                reports = parsed.map((r, i) => {
                    if (r && typeof r === 'object') {
                        let rawDate = r.report_date || r.upload_date || r.created_at || null;
                        let dateVal = formatReportDate(rawDate);
                        return {
                            name: (r.name && String(r.name).trim()) ? String(r.name).trim() : `Report ${i + 1}`,
                            url: r.url ? String(r.url).trim() : '',
                            report_date: dateVal,
                            upload_date: r.upload_date || dateVal || '',
                            created_at: r.created_at || ''
                        };
                    } else if (typeof r === 'string' && r.trim()) {
                        return {
                            name: `Report ${i + 1}`,
                            url: r.trim(),
                            report_date: 'Date not recorded',
                            upload_date: 'Date not recorded',
                            created_at: ''
                        };
                    }
                    return null;
                }).filter(r => r && r.url);
            }
        } catch (e) {
            console.error("Error parsing doctor_reports JSON:", e);
        }
    }

    // 2. Fallback to doctor_report_url comma-separated text string if reports array is empty
    if (reports.length === 0 && item.doctor_report_url) {
        const parts = String(item.doctor_report_url).split(",").map(u => u.trim()).filter(Boolean);
        reports = parts.map((part, i) => {
            if (part.includes("|||")) {
                const [url, name] = part.split("|||");
                return {
                    name: (name && name.trim()) ? name.trim() : `Report ${i + 1}`,
                    url: (url && url.trim()) ? url.trim() : '',
                    report_date: 'Date not recorded',
                    upload_date: 'Date not recorded',
                    created_at: ''
                };
            }
            return {
                name: `Report ${i + 1}`,
                url: part,
                report_date: 'Date not recorded',
                upload_date: 'Date not recorded',
                created_at: ''
            };
        }).filter(r => r.url);
    }

    return reports;
}

// Ensure dark-mode is permanently removed
localStorage.removeItem("app_theme");
if (document.body) {
    document.body.classList.remove("dark-mode");
}

