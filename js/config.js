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
