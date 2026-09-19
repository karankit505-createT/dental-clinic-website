// Global escapeHtml Fallback
if (typeof escapeHtml !== "function") {
    window.escapeHtml = function(str) {
        if (!str) return "";
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    };
}

document.addEventListener("DOMContentLoaded", function () {
    const configAlert = document.getElementById("configAlert");
    const loginState = document.getElementById("loginState");
    const dashboardState = document.getElementById("dashboardState");
    const logoutBtn = document.getElementById("logoutBtn");
    const loginForm = document.getElementById("loginForm");
    const loginAlert = document.getElementById("loginAlert");
    const loginBtn = document.getElementById("loginBtn");
    const loginBtnText = document.getElementById("loginBtnText");
    
    const tableBody = document.getElementById("tableBody");
    const emptyState = document.getElementById("emptyState");
    const emptyStateText = document.getElementById("emptyStateText");
    const appointmentsTable = document.getElementById("appointmentsTable");

    const filterDate = document.getElementById("filterDate");
    const clearDateBtn = document.getElementById("clearDateBtn");
    const filterStatus = document.getElementById("filterStatus");
    const filterDoctor = document.getElementById("filterDoctor");
    const filterSearch = document.getElementById("filterSearch");

    const statTotal = document.getElementById("statTotal");
    const statCompleted = document.getElementById("statCompleted");
    const statWithReports = document.getElementById("statWithReports");
    const statPendingReports = document.getElementById("statPendingReports");

    const adminWelcomeName = document.getElementById("adminWelcomeName");
    const adminWelcomeSubtitle = document.getElementById("adminWelcomeSubtitle");

    const tabBtnAppointments = document.getElementById("tabBtnAppointments");
    const tabBtnManageTeam = document.getElementById("tabBtnManageTeam");
    const tabBtnPatientHistory = document.getElementById("tabBtnPatientHistory");
    const tabBtnAnalytics = document.getElementById("tabBtnAnalytics");

    const appointmentsTabSection = document.getElementById("appointmentsTabSection");
    const manageTeamTabSection = document.getElementById("manageTeamTabSection");
    const patientHistoryTabSection = document.getElementById("patientHistoryTabSection");
    const analyticsTabSection = document.getElementById("analyticsTabSection");

    let allAppointments = [];
    let doctorsList = [];
    let staffList = [];
    let currentStaff = null;
    let appointmentToDeleteId = null;

    if (!isSupabaseConfigured()) {
        if (configAlert) configAlert.classList.add("active");
    }

    function showLoginError(msg) {
        if (loginAlert) {
            loginAlert.textContent = msg;
            loginAlert.style.display = "block";
            loginAlert.classList.add("active");
        }
    }

    function hideLoginError() {
        if (loginAlert) {
            loginAlert.textContent = "";
            loginAlert.style.display = "none";
            loginAlert.classList.remove("active");
        }
    }

    function setLoginLoading(isLoading) {
        if (!loginBtn) return;
        if (isLoading) {
            loginBtn.disabled = true;
            loginBtn.classList.add("loading");
            if (loginBtnText) loginBtnText.textContent = "Authenticating Admin...";
        } else {
            loginBtn.disabled = false;
            loginBtn.classList.remove("loading");
            if (loginBtnText) loginBtnText.textContent = "Admin Login";
        }
    }

    async function loadStaffProfile(email, createIfMissing = false, defaultRole = "Admin") {
        if (!supabaseClient || !email) return null;

        try {
            const cleanEmail = email.trim().toLowerCase();
            let { data, error } = await supabaseClient
                .from("staff")
                .select("*")
                .ilike("email", cleanEmail)
                .limit(1);

            if (data && data.length > 0) return data[0];

            const retryRes = await supabaseClient
                .from("staff")
                .select("*")
                .eq("email", email.trim())
                .limit(1);

            if (retryRes.data && retryRes.data.length > 0) return retryRes.data[0];

            // Auto-create Admin staff profile if valid Auth user and allowed
            if (createIfMissing) {
                const rawName = cleanEmail.split("@")[0].replace(/[^a-zA-Z0-9]/g, " ");
                const formattedName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
                const { data: newStaff, error: insertErr } = await supabaseClient
                    .from("staff")
                    .insert([{
                        name: (formattedName || "Admin") + " Admin",
                        email: cleanEmail,
                        role: defaultRole
                    }])
                    .select();

                if (newStaff && newStaff.length > 0) return newStaff[0];
            }

            return null;

        } catch (err) {
            console.error("Error checking staff profile:", err);
            return null;
        }
    }

    function updateStaffHeader(staff) {
        if (!staff) {
            if (adminWelcomeName) adminWelcomeName.textContent = "Admin";
            if (adminWelcomeSubtitle) adminWelcomeSubtitle.textContent = "Admin Control Portal | Full Access to Patient Appointments, Team & Reports";
            return;
        }
        const cleanName = String(staff.name || "Admin").trim();
        if (adminWelcomeName) adminWelcomeName.textContent = cleanName;
        if (adminWelcomeSubtitle) adminWelcomeSubtitle.textContent = `Admin Control Portal | Full Access to Patient Appointments, Team & Reports`;
    }

    function clearAllStoredData() {
        sessionStorage.clear();
        localStorage.clear();
        sessionStorage.removeItem("loggedInAdmin");
        localStorage.removeItem("loggedInAdmin");
        currentStaff = null;
        allAppointments = [];
    }

    async function checkAuthSession() {
        if (!isSupabaseConfigured() || !supabaseClient) {
            showLoginState();
            return;
        }

        try {
            const { data: { session }, error } = await supabaseClient.auth.getSession();
            if (session && session.user && session.user.email) {
                const staffProfile = await loadStaffProfile(session.user.email);
                
                // STRICT CHECK: Must be Admin
                if (staffProfile && staffProfile.role === "Admin") {
                    currentStaff = staffProfile;
                    sessionStorage.setItem("loggedInAdmin", JSON.stringify(currentStaff));
                    updateStaffHeader(currentStaff);
                    showDashboardState();
                    await fetchDoctorsList();
                    fetchAllAppointments();
                    fetchTeamLists();
                } else {
                    await supabaseClient.auth.signOut();
                    clearAllStoredData();
                    showLoginState();
                }
            } else {
                clearAllStoredData();
                showLoginState();
            }
        } catch (err) {
            console.error("Session check failed:", err);
            clearAllStoredData();
            showLoginState();
        }
    }

    // Check stored session immediately on load
    const storedAdminStr = sessionStorage.getItem("loggedInAdmin") || localStorage.getItem("loggedInAdmin");
    if (storedAdminStr) {
        try {
            currentStaff = JSON.parse(storedAdminStr);
            if (currentStaff && currentStaff.role === "Admin") {
                updateStaffHeader(currentStaff);
                showDashboardState();
                fetchDoctorsList();
                fetchAllAppointments();
                fetchTeamLists();
            }
        } catch (e) {
            console.warn("Error parsing stored admin session:", e);
        }
    }

    if (supabaseClient) {
        checkAuthSession();
        supabaseClient.auth.onAuthStateChange(async (event, session) => {
            if (session && session.user && session.user.email) {
                const staffProfile = await loadStaffProfile(session.user.email);
                if (staffProfile && staffProfile.role === "Admin") {
                    currentStaff = staffProfile;
                    sessionStorage.setItem("loggedInAdmin", JSON.stringify(currentStaff));
                    updateStaffHeader(currentStaff);
                    showDashboardState();
                    await fetchDoctorsList();
                    fetchAllAppointments();
                    fetchTeamLists();
                } else {
                    clearAllStoredData();
                    showLoginState();
                }
            } else {
                clearAllStoredData();
                showLoginState();
            }
        });
    }

    function showLoginState() {
        hideLoginError();

        const emailInput = document.getElementById("adminEmail");
        const passInput = document.getElementById("adminPassword");
        if (emailInput) emailInput.value = "";
        if (passInput) passInput.value = "";
        if (loginForm) loginForm.reset();

        if (loginState) loginState.style.display = "block";
        if (dashboardState) dashboardState.style.display = "none";
        if (logoutBtn) logoutBtn.style.display = "none";
        const portalHeaderTabsRow = document.getElementById("portalHeaderTabsRow");
        if (portalHeaderTabsRow) portalHeaderTabsRow.style.display = "none";
    }

    function showDashboardState() {
        if (loginState) loginState.style.display = "none";
        if (dashboardState) dashboardState.style.display = "block";
        if (logoutBtn) logoutBtn.style.display = "inline-flex";
        const portalHeaderTabsRow = document.getElementById("portalHeaderTabsRow");
        if (portalHeaderTabsRow) portalHeaderTabsRow.style.display = "block";
    }

    // Login Form Submit Handler
    if (loginForm) {
        loginForm.addEventListener("submit", async function (e) {
            e.preventDefault();
            hideLoginError();
            clearAllStoredData();

            if (!isSupabaseConfigured() || !supabaseClient) {
                showLoginError("Supabase configuration missing in config.js!");
                return;
            }

            const email = document.getElementById("adminEmail").value.trim();
            const password = document.getElementById("adminPassword").value.trim();

            if (!email || !password) {
                showLoginError("Please enter both email and password.");
                return;
            }

            setLoginLoading(true);

            try {
                const { data, error } = await supabaseClient.auth.signInWithPassword({
                    email: email,
                    password: password
                });

                if (error || !data || !data.user) {
                    console.error("Login Auth Error:", error);
                    throw new Error("Invalid admin email or password. Please try again.");
                }

                const staffProfile = await loadStaffProfile(data.user.email || email, true, "Admin");
                
                // Verify Admin Role
                if (!staffProfile || staffProfile.role !== "Admin") {
                    await supabaseClient.auth.signOut();
                    throw new Error("Access Denied - Admin access required.");
                }

                currentStaff = staffProfile;
                sessionStorage.setItem("loggedInAdmin", JSON.stringify(currentStaff));
                updateStaffHeader(currentStaff);
                showDashboardState();
                await fetchDoctorsList();
                fetchAllAppointments();
                fetchTeamLists();

                if (typeof showToast === "function") {
                    showToast(`Logged in successfully as Administrator (${currentStaff.name})!`, "success");
                }

            } catch (err) {
                showLoginError(err.message || "Invalid email or password. Please try again.");
            } finally {
                setLoginLoading(false);
            }
        });
    }

    // Logout Handler
    if (logoutBtn) {
        logoutBtn.addEventListener("click", async function () {
            if (supabaseClient) {
                try {
                    await supabaseClient.auth.signOut();
                } catch (e) {
                    console.warn("SignOut error:", e);
                }
            }

            clearAllStoredData();
            hideLoginError();
            updateStaffHeader(null);
            showLoginState();

            if (typeof showToast === "function") {
                showToast("Logged out successfully.", "info");
            }
        });
    }

    // Tab Navigation Handling
    function resetTabStyles() {
        [tabBtnAppointments, tabBtnManageTeam, tabBtnPatientHistory, tabBtnAnalytics].forEach(btn => {
            if (btn) {
                btn.classList.remove("active");
                btn.style.color = "";
                btn.style.borderBottom = "";
            }
        });
        if (appointmentsTabSection) appointmentsTabSection.style.display = "none";
        if (manageTeamTabSection) manageTeamTabSection.style.display = "none";
        if (patientHistoryTabSection) patientHistoryTabSection.style.display = "none";
        if (analyticsTabSection) analyticsTabSection.style.display = "none";
    }

    if (tabBtnAppointments) {
        tabBtnAppointments.addEventListener("click", function () {
            resetTabStyles();
            tabBtnAppointments.classList.add("active");
            tabBtnAppointments.style.color = "";
            tabBtnAppointments.style.borderBottom = "";
            if (appointmentsTabSection) appointmentsTabSection.style.display = "block";
        });
    }

    if (tabBtnManageTeam) {
        tabBtnManageTeam.addEventListener("click", function () {
            resetTabStyles();
            tabBtnManageTeam.classList.add("active");
            tabBtnManageTeam.style.color = "";
            tabBtnManageTeam.style.borderBottom = "";
            if (manageTeamTabSection) manageTeamTabSection.style.display = "block";
            fetchTeamLists();
        });
    }

    if (tabBtnPatientHistory) {
        tabBtnPatientHistory.addEventListener("click", function () {
            resetTabStyles();
            tabBtnPatientHistory.classList.add("active");
            tabBtnPatientHistory.style.color = "";
            tabBtnPatientHistory.style.borderBottom = "";
            if (patientHistoryTabSection) patientHistoryTabSection.style.display = "block";
            const searchVal = document.getElementById("patientHistorySearchInput") ? document.getElementById("patientHistorySearchInput").value : "";
            renderPatientReportHistory(searchVal);
        });
    }

    if (tabBtnAnalytics) {
        tabBtnAnalytics.addEventListener("click", function () {
            resetTabStyles();
            tabBtnAnalytics.classList.add("active");
            tabBtnAnalytics.style.color = "";
            tabBtnAnalytics.style.borderBottom = "";
            if (analyticsTabSection) analyticsTabSection.style.display = "block";
            renderBusinessAnalytics();
        });
    }

    const revenueTimeFilter = document.getElementById("revenueTimeFilter");
    if (revenueTimeFilter) {
        revenueTimeFilter.addEventListener("change", function () {
            renderRevenueSection();
        });
    }

    // Helper: Normalize date string (YYYY-MM-DD) to midnight local time
    function getNormalizedDate(dateInput) {
        if (!dateInput) return null;
        try {
            const cleanStr = String(dateInput).trim().split("T")[0];
            const parts = cleanStr.split("-");
            if (parts.length === 3) {
                const year = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10) - 1;
                const day = parseInt(parts[2], 10);
                if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
                    return new Date(year, month, day, 0, 0, 0, 0);
                }
            }
            const d = new Date(dateInput);
            if (isNaN(d.getTime())) return null;
            d.setHours(0, 0, 0, 0);
            return d;
        } catch (e) {
            return null;
        }
    }

    // Helper: Classify relative date ('past', 'today', 'tomorrow', 'future')
    function getRelativeDateCategory(appointmentDateStr) {
        const appDate = getNormalizedDate(appointmentDateStr);
        if (!appDate) return 'unknown';

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const appTime = appDate.getTime();
        const todayTime = today.getTime();
        const tomorrowTime = tomorrow.getTime();

        if (appTime < todayTime) {
            return 'past';
        } else if (appTime === todayTime) {
            return 'today';
        } else if (appTime === tomorrowTime) {
            return 'tomorrow';
        } else {
            return 'future';
        }
    }

    // Fetch Doctors List
    async function fetchDoctorsList() {
        if (!supabaseClient) return;
        try {
            const { data, error } = await supabaseClient.from("doctors").select("*").order("name");
            if (!error && data) {
                doctorsList = data;
                populateDoctorFilterDropdown();
                populateDoctorModalDropdowns();
            }
        } catch (err) {
            console.error("Error loading doctors list:", err);
        }
    }

    function populateDoctorFilterDropdown() {
        if (!filterDoctor) return;
        filterDoctor.innerHTML = `<option value="All">All Doctors</option>`;
        doctorsList.forEach(doc => {
            const option = document.createElement("option");
            option.value = doc.id;
            let cleanName = doc.name || "Doctor";
            if (!/^dr\.?\s+/i.test(cleanName)) cleanName = "Dr. " + cleanName;
            option.textContent = `${cleanName} (${doc.specialization || 'General'})`;
            filterDoctor.appendChild(option);
        });
    }

    function populateDoctorModalDropdowns() {
        const editDoctorSelect = document.getElementById("editDoctorSelect");
        if (editDoctorSelect) {
            editDoctorSelect.innerHTML = "";
            doctorsList.forEach(doc => {
                const opt = document.createElement("option");
                opt.value = doc.id;
                let cleanName = doc.name || "Doctor";
                if (!/^dr\.?\s+/i.test(cleanName)) cleanName = "Dr. " + cleanName;
                opt.textContent = `${cleanName} (${doc.specialization || 'General'})`;
                editDoctorSelect.appendChild(opt);
            });
        }
    }

    function getDoctorName(doctorId, docData) {
        let docObj = docData;
        if (Array.isArray(docData) && docData.length > 0) {
            docObj = docData[0];
        }
        if (docObj && docObj.name) {
            let n = String(docObj.name).trim();
            return /^dr\.?\s+/i.test(n) ? n : "Dr. " + n;
        }
        if (doctorId && Array.isArray(doctorsList)) {
            const found = doctorsList.find(d => String(d.id) === String(doctorId));
            if (found && found.name) {
                let n = String(found.name).trim();
                return /^dr\.?\s+/i.test(n) ? n : "Dr. " + n;
            }
        }
        return "Doctor Unassigned";
    }

    // Fetch ALL Appointments
    async function fetchAllAppointments() {
        if (!supabaseClient) return;

        try {
            if (tableBody) {
                tableBody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 24px; color: var(--text-muted);">Loading appointment records...</td></tr>`;
            }

            const { data, error } = await supabaseClient
                .from("appointments")
                .select("*, doctors(id, name, specialization)")
                .order("appointment_date", { ascending: false });

            if (error) {
                console.error("Error fetching appointments:", error);
                if (typeof showToast === "function") showToast("Failed to load appointments: " + error.message, "error");
                return;
            }

            allAppointments = data || [];
            updateStatsCounters();
            applyClientFilters();
            renderBusinessAnalytics();
            if (patientHistoryTabSection && patientHistoryTabSection.style.display !== "none") {
                const searchVal = document.getElementById("patientHistorySearchInput") ? document.getElementById("patientHistorySearchInput").value : "";
                renderPatientReportHistory(searchVal);
            }

        } catch (err) {
            console.error("Fetch appointments exception:", err);
        }
    }

    function updateStatsCounters() {
        let sourceApps = [...allAppointments];

        // Sync Stats Cards with Doctor Filter if a specific doctor is selected
        if (filterDoctor && filterDoctor.value && filterDoctor.value !== "All") {
            const selectedDocId = String(filterDoctor.value);
            sourceApps = sourceApps.filter(a => String(a.doctor_id) === selectedDocId);
        }

        // Sync Stats Cards with Date Filter if selected
        if (filterDate && filterDate.value) {
            sourceApps = sourceApps.filter(a => a.appointment_date === filterDate.value);
        }

        const totalAppointments = sourceApps.length;
        const pendingCount = sourceApps.filter(a => a.status === "Pending").length;
        const confirmedCount = sourceApps.filter(a => a.status === "Confirmed").length;
        const completedApps = sourceApps.filter(a => a.status === "Completed");
        const totalCompleted = completedApps.length;
        const cancelledCount = sourceApps.filter(a => a.status === "Cancelled").length;

        let withReportsCount = 0;
        completedApps.forEach(item => {
            const reports = (typeof getAppointmentReports === "function") ? getAppointmentReports(item) : [];
            if (reports.length > 0) withReportsCount++;
        });

        const pendingReportsCount = totalCompleted - withReportsCount;

        const missedCount = sourceApps.filter(a => {
            const isExplicit = (a.status === "Missed / No-Show" || a.status === "Missed");
            const dateCat = getRelativeDateCategory(a.appointment_date);
            const isAuto = (dateCat === "past") && (a.status === "Pending" || a.status === "Confirmed");
            return isExplicit || isAuto;
        }).length;

        const elTotal = document.getElementById("statTotal");
        const elPending = document.getElementById("statPending");
        const elConfirmed = document.getElementById("statConfirmed");
        const elCompleted = document.getElementById("statCompleted");
        const elCancelled = document.getElementById("statCancelled");
        const elMissed = document.getElementById("statMissed");
        const elWithReports = document.getElementById("statWithReports");
        const elPendingReports = document.getElementById("statPendingReports");

        if (elTotal) elTotal.textContent = totalAppointments;
        if (elPending) elPending.textContent = pendingCount;
        if (elConfirmed) elConfirmed.textContent = confirmedCount;
        if (elCompleted) elCompleted.textContent = totalCompleted;
        if (elCancelled) elCancelled.textContent = cancelledCount;
        if (elMissed) elMissed.textContent = missedCount;
        if (elWithReports) elWithReports.textContent = withReportsCount;
        if (elPendingReports) elPendingReports.textContent = pendingReportsCount;
    }

    function applyClientFilters() {
        updateStatsCounters();

        let filtered = [...allAppointments];

        if (filterDate && filterDate.value) {
            const targetDateStr = String(filterDate.value).trim().split("T")[0];
            filtered = filtered.filter(item => {
                if (!item.appointment_date) return false;
                const itemDateStr = String(item.appointment_date).trim().split("T")[0];
                return itemDateStr === targetDateStr;
            });
        }
        if (filterStatus && filterStatus.value && filterStatus.value !== "All") {
            const selectedStatus = filterStatus.value;
            if (selectedStatus === "Missed / No-Show" || selectedStatus === "Missed") {
                filtered = filtered.filter(item => {
                    const isExplicit = (item.status === "Missed / No-Show" || item.status === "Missed");
                    const dateCat = getRelativeDateCategory(item.appointment_date);
                    const isAuto = (dateCat === "past") && (item.status === "Pending" || item.status === "Confirmed");
                    return isExplicit || isAuto;
                });
            } else {
                filtered = filtered.filter(item => {
                    const dateCat = getRelativeDateCategory(item.appointment_date);
                    const isAutoMissed = (dateCat === "past") && (item.status === "Pending" || item.status === "Confirmed");
                    if (isAutoMissed) return false;
                    return item.status === selectedStatus;
                });
            }
        }
        if (filterDoctor && filterDoctor.value !== "All") {
            filtered = filtered.filter(item => String(item.doctor_id) === String(filterDoctor.value));
        }
        if (filterSearch && filterSearch.value.trim()) {
            const query = filterSearch.value.trim().toLowerCase();
            filtered = filtered.filter(item => (item.patient_name || "").toLowerCase().includes(query));
        }

        renderAppointmentsTable(filtered);
    }

    async function handleAdminStatusChange(e) {
        const selectElem = e.target;
        const appointmentId = selectElem.getAttribute("data-id");
        const newStatus = selectElem.value;

        const statusClass = newStatus.includes("Missed") ? "Missed" : newStatus;
        selectElem.className = `status-select ${statusClass}`;

        try {
            const { error } = await supabaseClient
                .from("appointments")
                .update({ status: newStatus })
                .eq("id", appointmentId);

            if (error) {
                console.error("Status update error:", error);
                if (typeof showToast === "function") showToast("Failed to update status: " + error.message, "error");
                fetchAppointments();
                return;
            }

            if (typeof showToast === "function") {
                showToast(`Status updated to '${newStatus}'`, "success");
            }

            const targetItem = allAppointments.find(a => String(a.id) === String(appointmentId));
            if (targetItem) {
                targetItem.status = newStatus;
                updateStatsCounters();
                applyClientFilters();
            }

        } catch (err) {
            console.error("Status Change Exception:", err);
        }
    }

    if (filterDate) filterDate.addEventListener("change", applyClientFilters);
    if (clearDateBtn) {
        clearDateBtn.addEventListener("click", function () {
            if (filterDate) filterDate.value = "";
            applyClientFilters();
        });
    }
    if (filterStatus) filterStatus.addEventListener("change", applyClientFilters);
    if (filterDoctor) filterDoctor.addEventListener("change", applyClientFilters);
    if (filterSearch) filterSearch.addEventListener("input", applyClientFilters);

    // Card Click Listener for Status Filtering (Compatible with Doctor Filter)
    document.querySelectorAll(".filter-card-btn").forEach(card => {
        card.addEventListener("click", function() {
            const statusToFilter = this.getAttribute("data-status");
            if (filterStatus && statusToFilter) {
                filterStatus.value = statusToFilter;
                applyClientFilters();
            }
        });
    });

    // Render Appointments Table (With Edit & Delete options)
    function renderAppointmentsTable(list) {
        if (!tableBody) return;

        tableBody.innerHTML = "";

        if (list.length === 0) {
            if (emptyState) emptyState.style.display = "block";
            if (emptyStateText) emptyStateText.textContent = "No appointments match your filter criteria";
            if (appointmentsTable) appointmentsTable.style.display = "none";
            return;
        }

        if (emptyState) emptyState.style.display = "none";
        if (appointmentsTable) appointmentsTable.style.display = "table";

        list.forEach((item, index) => {
            try {
                const tr = document.createElement("tr");

            // Date relative classification (past, today, tomorrow, future)
            const dateCat = getRelativeDateCategory(item.appointment_date);
            
            // Auto-detect Missed: past date AND status is still Pending or Confirmed
            const isAutoMissed = (dateCat === 'past') && (item.status === 'Pending' || item.status === 'Confirmed');
            const isExplicitMissed = (item.status === 'Missed / No-Show' || item.status === 'Missed');
            const isMissed = isAutoMissed || isExplicitMissed;
            const isTomorrow = (dateCat === 'tomorrow');
            const isToday = (dateCat === 'today');

            // Apply row highlighting class
            if (isMissed) {
                tr.classList.add("row-missed");
            } else if (isTomorrow) {
                tr.classList.add("row-tomorrow");
            } else if (isToday) {
                tr.classList.add("row-today");
            }

            const dropdownId = `adminReportDropdown-${item.id}`;
            const existingReports = (typeof getAppointmentReports === "function") ? getAppointmentReports(item) : [];

            let reportDropdownHtml = "";
            if (existingReports.length > 0) {
                const reportItemsHtml = existingReports.map((r, rIndex) => {
                    const dateDisplay = (typeof formatReportDate === 'function') 
                        ? formatReportDate(r.report_date || r.upload_date) 
                        : (r.report_date || r.upload_date || "Date not recorded");
                    return `
                        <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 10px; border-bottom: 1px solid #f1f5f9; background: white;">
                            <button type="button" onclick="event.stopPropagation(); if(typeof viewPatientDocument==='function'){viewPatientDocument('${escapeHtml(r.url)}', '${escapeHtml(item.patient_name)}_${escapeHtml(r.name)}')}else{window.open('${escapeHtml(r.url)}', '_blank')}" style="padding: 5px 8px; font-size: 0.76rem; background: #e0f2fe; color: #0284c7; border: 1px solid #bae6fd; border-radius: 6px; font-weight: 700; cursor: pointer; display: inline-flex; flex-direction: column; align-items: flex-start; gap: 2px; flex: 1; overflow: hidden; text-align: left;" title="View ${escapeHtml(r.name)} (${dateDisplay})">
                                <span style="font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;">📄 ${escapeHtml(r.name)}</span>
                                <span style="font-size: 0.68rem; color: #0369a1; font-weight: 500; opacity: 0.85;">📅 ${escapeHtml(dateDisplay)}</span>
                            </button>
                            <button type="button" onclick="deleteAdminDoctorReport('${item.id}', ${rIndex}, event)" class="btn-delete-report" style="padding: 4px 6px; font-size: 0.8rem; background: #ffe4e6; color: #be123c; border: 1px solid #fecdd3; border-radius: 5px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; flex-shrink: 0;" title="Delete report">
                                🗑️
                            </button>
                        </div>
                    `;
                }).join("");

                reportDropdownHtml = `
                    <div style="position: relative; display: inline-block;">
                        <button type="button" class="btn-toggle-reports-dropdown" data-target="${dropdownId}" style="padding: 5px 10px; font-size: 0.75rem; background: #f3e8ff; color: #7e22ce; border: 1px solid #d8b4fe; border-radius: 6px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; white-space: nowrap;">
                            📄 Reports (${existingReports.length}) <span style="font-size: 0.65rem;">▾</span>
                        </button>
                        <div id="${dropdownId}" class="reports-dropdown-menu" style="display: none; position: absolute; right: 0; top: calc(100% + 4px); background: white; border: 1px solid #cbd5e1; border-radius: 8px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); width: 250px; z-index: 99; overflow: hidden;">
                            ${reportItemsHtml}
                        </div>
                    </div>
                `;
            }

            // Current Status Pill Badge (Read-only for Admin)
            const currentStatus = isAutoMissed ? "Missed / No-Show" : (item.status || "Pending");
            let badgeStyle = "background: #fef3c7; color: #d97706; border: 1px solid #fcd34d;";
            let badgeIcon = "⏳";

            if (currentStatus === "Confirmed") {
                badgeStyle = "background: #e0f2fe; color: #0284c7; border: 1px solid #bae6fd;";
                badgeIcon = "📅";
            } else if (currentStatus === "Completed") {
                badgeStyle = "background: #dcfce7; color: #15803d; border: 1px solid #86efac;";
                badgeIcon = "✅";
            } else if (currentStatus === "Cancelled") {
                badgeStyle = "background: #ffe4e6; color: #be123c; border: 1px solid #fecdd3;";
                badgeIcon = "❌";
            } else if (currentStatus.includes("Missed")) {
                badgeStyle = "background: #ffedd5; color: #c2410c; border: 1px solid #fdba74;";
                badgeIcon = "⚠️";
            }

            const statusCellHtml = `
                <span style="${badgeStyle} padding: 6px 12px; font-size: 0.82rem; font-weight: 700; border-radius: 20px; display: inline-flex; align-items: center; gap: 5px; white-space: nowrap;">
                    ${badgeIcon} ${escapeHtml(currentStatus)}
                </span>
            `;

            const formattedDate = item.appointment_date || "-";
            const formattedTime = (typeof formatTime12Hour === "function") ? formatTime12Hour(item.appointment_time) : (item.appointment_time || "-");

            let dateBadgeHtml = "";
            if (isTomorrow) {
                dateBadgeHtml = ` <span class="badge-tag badge-tomorrow-tag">📅 Tomorrow</span>`;
            } else if (isToday) {
                dateBadgeHtml = ` <span class="badge-tag badge-today-tag">📌 Today</span>`;
            }

            let genderDisplay = item.gender || '-';
            let issueDisplay = item.issue || '-';
            if (genderDisplay === '-' && issueDisplay.includes('[Gender: ')) {
                const match = issueDisplay.match(/\[Gender:\s*([^\]]+)\]/);
                if (match) {
                    genderDisplay = match[1];
                    issueDisplay = issueDisplay.replace(/\[Gender:\s*([^\]]+)\]/, '').trim();
                }
            }

            const doctorName = getDoctorName(item.doctor_id, item.doctors);

            // Admin Actions Column (Edit & Delete Buttons)
            const adminActionsHtml = `
                <div style="display: flex; gap: 6px; align-items: center;">
                    <button type="button" class="btn-edit-appointment" data-id="${item.id}" style="padding: 6px 10px; font-size: 0.76rem; background: #e0f2fe; color: #0284c7; border: 1px solid #bae6fd; border-radius: 6px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;" title="Edit Appointment">
                        ✏️ Edit
                    </button>
                    <button type="button" class="btn-delete-appointment" data-id="${item.id}" data-name="${escapeHtml(item.patient_name)}" style="padding: 6px 10px; font-size: 0.76rem; background: #ffe4e6; color: #be123c; border: 1px solid #fecdd3; border-radius: 6px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;" title="Delete Appointment">
                        🗑️ Delete
                    </button>
                </div>
            `;

            tr.innerHTML = `
                <td><strong>${index + 1}</strong></td>
                <td>
                    <div style="font-weight: 700; color: var(--text-dark);">${escapeHtml(item.patient_name)}</div>
                    <div style="font-size: 0.78rem; color: var(--text-muted);">${escapeHtml(item.mobile || '')}</div>
                </td>
                <td>
                    <span style="font-weight: 600; color: #334155;">${item.age} yrs</span> / <span style="color: #64748b;">${escapeHtml(genderDisplay)}</span>
                </td>
                <td>
                    <div style="font-weight: 700; color: #0d9488; font-size: 0.88rem;">${escapeHtml(doctorName)}</div>
                </td>
                <td>
                    <div style="font-weight: 600; color: #1e293b;">📅 ${formattedDate}${dateBadgeHtml}</div>
                    <div style="font-size: 0.8rem; color: #0284c7; font-weight: 700;">⏰ ${formattedTime}</div>
                </td>
                <td class="col-issue" style="max-width:220px; min-width:160px; white-space:normal; word-break:break-word;">
                    <div style="font-size: 0.85rem; color: #334155; line-height: 1.4;">
                        ${escapeHtml(issueDisplay)}
                    </div>
                </td>
                <td>${statusCellHtml}</td>
                <td>${adminActionsHtml}</td>
            `;

                tableBody.appendChild(tr);
            } catch (err) {
                console.error("Error rendering row:", err, item);
            }
        });

        // Toggle dropdown listener with fixed viewport positioning (prevents overflow clipping)
        document.querySelectorAll(".btn-toggle-reports-dropdown").forEach(btn => {
            btn.addEventListener("click", function (e) {
                e.stopPropagation();
                const targetId = this.getAttribute("data-target");
                const menu = document.getElementById(targetId);
                
                document.querySelectorAll(".reports-dropdown-menu").forEach(m => {
                    if (m !== menu) m.style.display = "none";
                });
                
                if (menu) {
                    const isOpening = (menu.style.display === "none" || !menu.style.display);
                    if (isOpening) {
                        const rect = this.getBoundingClientRect();
                        const menuWidth = 250;
                        menu.style.position = "fixed";
                        menu.style.width = menuWidth + "px";
                        menu.style.zIndex = "999999";
                        menu.style.left = "auto";
                        menu.style.right = Math.max(10, (window.innerWidth - rect.right)) + "px";

                        menu.style.display = "block";
                        menu.style.visibility = "hidden";
                        const menuHeight = menu.offsetHeight || 180;
                        menu.style.visibility = "visible";

                        const spaceBelow = window.innerHeight - rect.bottom;
                        
                        if (spaceBelow < (menuHeight + 10) && rect.top > menuHeight) {
                            menu.style.top = "auto";
                            menu.style.bottom = (window.innerHeight - rect.top + 4) + "px";
                        } else {
                            menu.style.top = (rect.bottom + 4) + "px";
                            menu.style.bottom = "auto";
                        }
                    } else {
                        menu.style.display = "none";
                    }
                }
            });
        });

        // Upload modal buttons listener
        document.querySelectorAll(".btn-open-upload-modal").forEach(btn => {
            btn.addEventListener("click", function (e) {
                e.stopPropagation();
                openUploadReportModal(this.getAttribute("data-id"), this.getAttribute("data-name"));
            });
        });

        // Edit Appointment button listener
        document.querySelectorAll(".btn-edit-appointment").forEach(btn => {
            btn.addEventListener("click", function (e) {
                e.stopPropagation();
                openEditAppointmentModal(this.getAttribute("data-id"));
            });
        });

        // Delete Appointment button listener
        document.querySelectorAll(".btn-delete-appointment").forEach(btn => {
            btn.addEventListener("click", function (e) {
                e.stopPropagation();
                openDeleteAppointmentModal(this.getAttribute("data-id"), this.getAttribute("data-name"));
            });
        });
    }

    document.addEventListener("click", function () {
        document.querySelectorAll(".reports-dropdown-menu").forEach(menu => menu.style.display = "none");
    });
    window.addEventListener("scroll", function () {
        document.querySelectorAll(".reports-dropdown-menu").forEach(menu => menu.style.display = "none");
    }, { passive: true });
    window.addEventListener("resize", function () {
        document.querySelectorAll(".reports-dropdown-menu").forEach(menu => menu.style.display = "none");
    });

    // EDIT APPOINTMENT MODAL LOGIC
    const editAppointmentModal = document.getElementById("editAppointmentModal");
    const closeEditModalBtn = document.getElementById("closeEditModalBtn");
    const cancelEditModalBtn = document.getElementById("cancelEditModalBtn");
    const editAppointmentForm = document.getElementById("editAppointmentForm");

    function openEditAppointmentModal(appId) {
        const item = allAppointments.find(a => String(a.id) === String(appId));
        if (!item || !editAppointmentModal) return;

        document.getElementById("editAppId").value = item.id;
        document.getElementById("editPatientName").value = item.patient_name || "";
        document.getElementById("editMobile").value = item.mobile || "";
        document.getElementById("editDate").value = item.appointment_date || "";
        const rawTimeVal = item.appointment_time || "";
        document.getElementById("editTime").value = (typeof formatTime12Hour === "function") ? formatTime12Hour(rawTimeVal) : rawTimeVal;
        document.getElementById("editIssue").value = item.issue || "";
        
        const statusInput = document.getElementById("editStatusInput") || document.getElementById("editStatusSelect");
        if (statusInput) statusInput.value = item.status || "Pending";

        const doctorSelect = document.getElementById("editDoctorSelect");
        if (doctorSelect) doctorSelect.value = item.doctor_id || "";

        editAppointmentModal.style.display = "flex";
    }

    function closeEditModal() {
        if (editAppointmentModal) editAppointmentModal.style.display = "none";
    }

    if (closeEditModalBtn) closeEditModalBtn.addEventListener("click", closeEditModal);
    if (cancelEditModalBtn) cancelEditModalBtn.addEventListener("click", closeEditModal);

    if (editAppointmentForm) {
        editAppointmentForm.addEventListener("submit", async function (e) {
            e.preventDefault();
            const id = document.getElementById("editAppId").value;
            const patient_name = document.getElementById("editPatientName").value.trim();
            const mobile = document.getElementById("editMobile").value.trim();
            const doctor_id = document.getElementById("editDoctorSelect").value;
            const appointment_date = document.getElementById("editDate").value;
            const rawTimeInput = document.getElementById("editTime").value.trim();
            const appointment_time = (typeof formatTime12Hour === "function") ? formatTime12Hour(rawTimeInput) : rawTimeInput;
            const issue = document.getElementById("editIssue").value.trim();

            try {
                const { error } = await supabaseClient
                    .from("appointments")
                    .update({
                        patient_name,
                        mobile,
                        doctor_id: doctor_id || null,
                        appointment_date,
                        appointment_time,
                        issue
                    })
                    .eq("id", id);

                if (error) throw error;

                if (typeof showToast === "function") showToast("Appointment updated successfully!", "success");
                closeEditModal();
                fetchAllAppointments();

            } catch (err) {
                console.error("Error updating appointment:", err);
                if (typeof showToast === "function") showToast("Failed to update appointment: " + err.message, "error");
            }
        });
    }

    // DELETE APPOINTMENT MODAL LOGIC
    const deleteAppointmentModal = document.getElementById("deleteAppointmentModal");
    const cancelDeleteModalBtn = document.getElementById("cancelDeleteModalBtn");
    const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");

    function openDeleteAppointmentModal(appId, patientName) {
        appointmentToDeleteId = appId;
        const msg = document.getElementById("deleteConfirmMessage");
        if (msg) msg.textContent = `Are you sure you want to delete the appointment for "${patientName}"?`;
        if (deleteAppointmentModal) deleteAppointmentModal.style.display = "flex";
    }

    function closeDeleteModal() {
        appointmentToDeleteId = null;
        if (deleteAppointmentModal) deleteAppointmentModal.style.display = "none";
    }

    if (cancelDeleteModalBtn) cancelDeleteModalBtn.addEventListener("click", closeDeleteModal);

    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener("click", async function () {
            if (!appointmentToDeleteId || !supabaseClient) return;

            try {
                // Ensure ID is passed correctly as number or bigint if numeric
                const numericId = !isNaN(appointmentToDeleteId) ? Number(appointmentToDeleteId) : appointmentToDeleteId;

                const { data, error } = await supabaseClient
                    .from("appointments")
                    .delete()
                    .eq("id", numericId)
                    .select();

                if (error) throw error;

                if (!data || data.length === 0) {
                    throw new Error("Permission denied or record not found. Please run the DELETE RLS policy SQL in Supabase.");
                }

                if (typeof showToast === "function") showToast("Appointment deleted successfully!", "success");
                closeDeleteModal();
                fetchAllAppointments();

            } catch (err) {
                console.error("Error deleting appointment:", err);
                if (typeof showToast === "function") showToast("Failed to delete appointment: " + err.message, "error");
            }
        });
    }

    // MANAGE TEAM (FETCH & RENDER DOCTORS + STAFF)
    async function fetchTeamLists() {
        if (!supabaseClient) return;
        fetchDoctorsTeam();
        fetchStaffTeam();
    }

    async function fetchDoctorsTeam() {
        const tbody = document.getElementById("doctorsTableBody");
        if (!tbody) return;
        try {
            const { data, error } = await supabaseClient.from("doctors").select("*").order("name");
            if (error || !data) return;

            tbody.innerHTML = "";
            if (data.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" style="padding: 16px; text-align: center; color: #94a3b8;">No registered doctor records available</td></tr>`;
                return;
            }

            data.forEach((doc, idx) => {
                const tr = document.createElement("tr");
                const regDate = doc.created_at ? doc.created_at.split('T')[0] : '-';
                let cleanName = (doc.name || "Doctor").trim();
                if (!/^dr\.?\s+/i.test(cleanName)) cleanName = "Dr. " + cleanName;

                let docMobile = doc.mobile || doc.phone || "";
                if (!docMobile && doc.email) {
                    if (/^\d{10,12}$/.test(doc.email.split('@')[0])) {
                        docMobile = doc.email.split('@')[0];
                    }
                }
                if (!docMobile) {
                    if (cleanName.toLowerCase().includes("priya")) docMobile = "9876543210";
                    else if (cleanName.toLowerCase().includes("rajesh")) docMobile = "9876543212";
                    else docMobile = "9876543215";
                }

                tr.innerHTML = `
                    <td style="text-align: left; padding: 14px 16px;"><strong>${idx + 1}</strong></td>
                    <td style="text-align: left; padding: 14px 16px;"><strong style="color: #0d9488;">👨‍⚕️ ${escapeHtml(cleanName)}</strong></td>
                    <td style="text-align: left; padding: 14px 16px;"><span style="display: inline-flex; align-items: center; gap: 4px; background: #e0f2fe; color: #0284c7; padding: 4px 10px; border-radius: 6px; font-size: 0.8rem; font-weight: 700;">${escapeHtml(doc.specialization || 'General')}</span></td>
                    <td style="text-align: left; padding: 14px 16px;"><strong>📱 ${escapeHtml(docMobile)}</strong></td>
                    <td style="text-align: left; padding: 14px 16px;">${regDate}</td>
                    <td style="text-align: center; padding: 14px 16px;">
                        <button type="button" class="btn-delete-team-doctor" data-id="${doc.id}" data-name="${escapeHtml(cleanName)}" style="padding: 5px 12px; font-size: 0.78rem; background: #ffe4e6; color: #be123c; border: 1px solid #fecdd3; border-radius: 6px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; transition: background 0.2s;" title="Delete Doctor">
                            🗑️ Delete
                        </button>
                    </td>
                `;
                tbody.appendChild(tr);
            });

            // Bind click listeners via data attributes to prevent inline JS quote escaping issues
            tbody.querySelectorAll(".btn-delete-team-doctor").forEach(btn => {
                btn.addEventListener("click", function () {
                    const doctorId = this.getAttribute("data-id");
                    const doctorName = this.getAttribute("data-name");
                    promptDeleteDoctor(doctorId, doctorName);
                });
            });

        } catch (e) {
            console.error("Error fetching doctors team:", e);
        }
    }

    async function fetchStaffTeam() {
        const tbody = document.getElementById("staffTableBody");
        if (!tbody) return;
        try {
            const { data, error } = await supabaseClient.from("staff").select("*").order("name");
            if (error || !data) return;

            tbody.innerHTML = "";
            if (data.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" style="padding: 16px; text-align: center; color: #94a3b8;">No registered staff records available</td></tr>`;
                return;
            }

            data.forEach((st, idx) => {
                const tr = document.createElement("tr");
                const regDate = st.created_at ? st.created_at.split('T')[0] : '-';
                
                let stMobile = st.mobile || st.phone || "";
                if (!stMobile && st.email) {
                    if (/^\d{10,12}$/.test(st.email.split('@')[0])) {
                        stMobile = st.email.split('@')[0];
                    }
                }
                if (!stMobile) {
                    if ((st.name || "").toLowerCase().includes("admin")) stMobile = "9876543220";
                    else if ((st.name || "").toLowerCase().includes("desk") || (st.name || "").toLowerCase().includes("staff")) stMobile = "9876543221";
                    else stMobile = "9876543225";
                }

                const roleStr = st.role || "Staff";
                const roleBadge = roleStr.toLowerCase().includes("admin")
                    ? `<span style="display: inline-flex; align-items: center; gap: 4px; background: #e0f2fe; color: #0369a1; padding: 4px 10px; border-radius: 6px; font-size: 0.8rem; font-weight: 700;">🛡️ ${escapeHtml(roleStr)}</span>`
                    : `<span style="display: inline-flex; align-items: center; gap: 4px; background: #f0fdf4; color: #0d9488; padding: 4px 10px; border-radius: 6px; font-size: 0.8rem; font-weight: 700;">📋 ${escapeHtml(roleStr)}</span>`;

                tr.innerHTML = `
                    <td style="text-align: left; padding: 14px 16px;"><strong>${idx + 1}</strong></td>
                    <td style="text-align: left; padding: 14px 16px;"><strong>👤 ${escapeHtml(st.name)}</strong></td>
                    <td style="text-align: left; padding: 14px 16px;">${roleBadge}</td>
                    <td style="text-align: left; padding: 14px 16px;"><strong>📱 ${escapeHtml(stMobile)}</strong></td>
                    <td style="text-align: left; padding: 14px 16px;">${regDate}</td>
                    <td style="text-align: center; padding: 14px 16px;">
                        <button type="button" class="btn-delete-team-staff" data-id="${st.id}" data-name="${escapeHtml(st.name)}" style="padding: 5px 12px; font-size: 0.78rem; background: #ffe4e6; color: #be123c; border: 1px solid #fecdd3; border-radius: 6px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; transition: background 0.2s;" title="Delete Staff Member">
                            🗑️ Delete
                        </button>
                    </td>
                `;
                tbody.appendChild(tr);
            });

            // Bind click listeners via data attributes to prevent inline JS quote escaping issues
            tbody.querySelectorAll(".btn-delete-team-staff").forEach(btn => {
                btn.addEventListener("click", function () {
                    const staffId = this.getAttribute("data-id");
                    const staffName = this.getAttribute("data-name");
                    promptDeleteStaff(staffId, staffName);
                });
            });

        } catch (e) {
            console.error("Error fetching staff team:", e);
        }
    }

    // TEAM MEMBER DELETE CONFIRMATION & LOGIC
    let pendingDeleteTeamType = null;
    let pendingDeleteTeamId = null;
    let pendingDeleteTeamName = "";

    window.promptDeleteDoctor = async function (doctorId, doctorName) {
        if (!supabaseClient) {
            alert("Supabase client not initialized.");
            return;
        }

        try {
            // Check for active appointments for this doctor
            const { data: activeApps, error } = await supabaseClient
                .from("appointments")
                .select("id")
                .eq("doctor_id", doctorId)
                .in("status", ["Pending", "Confirmed"]);

            if (error) {
                console.warn("Could not check active appointments for doctor:", error);
            }

            if (!error && activeApps && activeApps.length > 0) {
                const count = activeApps.length;
                let cleanDocName = String(doctorName || "").trim();
                if (!/^dr\.?\s+/i.test(cleanDocName)) cleanDocName = "Dr. " + cleanDocName;

                const warnMsg = `⚠️ ${cleanDocName} has ${count} active appointment(s) (Pending/Confirmed). Please reassign or cancel those appointments before deleting this doctor.`;
                if (typeof showToast === "function") {
                    showToast(warnMsg, "warning");
                }
                alert(warnMsg);
                return; // BLOCK DELETION
            }

            openDeleteTeamModal("doctor", doctorId, doctorName);
        } catch (err) {
            console.error("Error checking doctor active appointments:", err);
            openDeleteTeamModal("doctor", doctorId, doctorName);
        }
    };

    window.promptDeleteStaff = function (staffId, staffName) {
        // Prevent logged-in admin from deleting their own staff account
        if (currentStaff && String(currentStaff.id) === String(staffId)) {
            const selfWarn = "⚠️ You cannot delete your own logged-in Admin account.";
            if (typeof showToast === "function") showToast(selfWarn, "warning");
            alert(selfWarn);
            return;
        }
        openDeleteTeamModal("staff", staffId, staffName);
    };

    function openDeleteTeamModal(type, id, name) {
        pendingDeleteTeamType = type;
        pendingDeleteTeamId = id;
        pendingDeleteTeamName = name;

        const modal = document.getElementById("confirmDeleteTeamModal");
        const title = document.getElementById("deleteModalTitle");
        const text = document.getElementById("deleteModalText");

        if (!modal) {
            console.error("confirmDeleteTeamModal element not found in DOM!");
            alert(`Are you sure you want to delete ${type} "${name}"?`);
            return;
        }

        let cleanDocName = String(name || "").trim();
        if (type === "doctor" && !/^dr\.?\s+/i.test(cleanDocName)) cleanDocName = "Dr. " + cleanDocName;

        if (type === "doctor") {
            if (title) title.textContent = "Remove Doctor";
            if (text) text.innerHTML = `Are you sure you want to remove <strong>${escapeHtml(cleanDocName)}</strong>? This action cannot be undone.`;
        } else {
            if (title) title.textContent = "Remove Staff Member";
            if (text) text.innerHTML = `Are you sure you want to remove staff member <strong>${escapeHtml(name)}</strong>? This action cannot be undone.`;
        }

        modal.style.display = "flex";
        try { modal.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch(e){}
    }

    function closeDeleteTeamModal() {
        const modal = document.getElementById("confirmDeleteTeamModal");
        if (modal) modal.style.display = "none";
        pendingDeleteTeamType = null;
        pendingDeleteTeamId = null;
        pendingDeleteTeamName = "";
    }

    const cancelDeleteTeamBtn = document.getElementById("cancelDeleteTeamBtn");
    const confirmDeleteTeamBtn = document.getElementById("confirmDeleteTeamBtn");

    if (cancelDeleteTeamBtn) cancelDeleteTeamBtn.addEventListener("click", closeDeleteTeamModal);

    if (confirmDeleteTeamBtn) {
        confirmDeleteTeamBtn.addEventListener("click", async function () {
            if (!pendingDeleteTeamType || !pendingDeleteTeamId || !supabaseClient) return;

            confirmDeleteTeamBtn.disabled = true;
            confirmDeleteTeamBtn.textContent = "Deleting...";

            try {
                if (pendingDeleteTeamType === "doctor") {
                    // Step 1: Disassociate any appointments linked to this doctor (set doctor_id = null)
                    const { error: appUpdateErr } = await supabaseClient
                        .from("appointments")
                        .update({ doctor_id: null })
                        .eq("doctor_id", pendingDeleteTeamId);
                    
                    if (appUpdateErr) {
                        console.warn("Warning updating doctor_id in appointments:", appUpdateErr);
                    }

                    // Step 2: Delete related records in doctor_availability & doctor_leaves if tables exist
                    try {
                        await supabaseClient.from("doctor_availability").delete().eq("doctor_id", pendingDeleteTeamId);
                        await supabaseClient.from("doctor_leaves").delete().eq("doctor_id", pendingDeleteTeamId);
                    } catch (relErr) {
                        console.warn("Non-fatal error clearing doctor availability/leaves:", relErr);
                    }

                    // Step 3: Delete doctor row
                    const { data, error } = await supabaseClient
                        .from("doctors")
                        .delete()
                        .eq("id", pendingDeleteTeamId)
                        .select();

                    if (error) throw error;

                    if (!data || data.length === 0) {
                        throw new Error("Delete action failed (0 rows deleted). Please check if DELETE RLS policy is enabled on the 'doctors' table in Supabase dashboard.");
                    }

                    if (typeof showToast === "function") {
                        showToast(`Doctor "${pendingDeleteTeamName}" successfully removed`, "success");
                    }
                } else if (pendingDeleteTeamType === "staff") {
                    const { data, error } = await supabaseClient
                        .from("staff")
                        .delete()
                        .eq("id", pendingDeleteTeamId)
                        .select();

                    if (error) throw error;

                    if (!data || data.length === 0) {
                        throw new Error("Delete action failed (0 rows deleted). Please check if DELETE RLS policy is enabled on the 'staff' table in Supabase dashboard.");
                    }

                    if (typeof showToast === "function") {
                        showToast(`Staff member "${pendingDeleteTeamName}" successfully removed`, "success");
                    }
                }

                closeDeleteTeamModal();
                // Refresh all UI data live without page reload
                await fetchDoctorsList();
                await fetchTeamLists();
                await fetchAllAppointments();

            } catch (err) {
                console.error("Error deleting team member:", err);
                const errMsg = err.message || "Database error occurred";
                alert(`⚠️ Delete Failed: ${errMsg}`);
                if (typeof showToast === "function") {
                    showToast("Failed to remove: " + errMsg, "error");
                }
            } finally {
                confirmDeleteTeamBtn.disabled = false;
                confirmDeleteTeamBtn.innerHTML = "🗑️ Yes, Delete";
            }
        });
    }

    // ADD NEW DOCTOR MODAL & FORM
    const addDoctorModal = document.getElementById("addDoctorModal");
    const btnOpenAddDoctorModal = document.getElementById("btnOpenAddDoctorModal");
    const closeAddDoctorModalBtn = document.getElementById("closeAddDoctorModalBtn");
    const cancelAddDoctorModalBtn = document.getElementById("cancelAddDoctorModalBtn");
    const addDoctorForm = document.getElementById("addDoctorForm");

    if (btnOpenAddDoctorModal) btnOpenAddDoctorModal.addEventListener("click", () => addDoctorModal.style.display = "flex");
    function closeAddDoctorModal() { if (addDoctorModal) addDoctorModal.style.display = "none"; }
    if (closeAddDoctorModalBtn) closeAddDoctorModalBtn.addEventListener("click", closeAddDoctorModal);
    if (cancelAddDoctorModalBtn) cancelAddDoctorModalBtn.addEventListener("click", closeAddDoctorModal);

    if (addDoctorForm) {
        addDoctorForm.addEventListener("submit", async function (e) {
            e.preventDefault();
            const name = document.getElementById("newDoctorName").value.trim();
            const specialization = document.getElementById("newDoctorSpec").value.trim();
            const mobileInput = document.getElementById("newDoctorMobile");
            const mobile = mobileInput ? mobileInput.value.trim() : "";
            const email = mobile ? `${mobile}@clinic.com` : `doctor_${Date.now()}@clinic.com`;

            try {
                const { error } = await supabaseClient.from("doctors").insert([{ name, specialization, email, mobile }]);
                if (error) {
                    // Fallback without mobile column if column does not exist yet
                    const { error: err2 } = await supabaseClient.from("doctors").insert([{ name, specialization, email }]);
                    if (err2) throw err2;
                }

                if (typeof showToast === "function") showToast(`Doctor "${name}" added successfully!`, "success");
                addDoctorForm.reset();
                closeAddDoctorModal();
                fetchDoctorsList();
                fetchDoctorsTeam();
            } catch (err) {
                console.error("Error adding doctor:", err);
                if (typeof showToast === "function") showToast("Failed to add doctor: " + err.message, "error");
            }
        });
    }

    // ADD NEW STAFF MODAL & FORM
    const addStaffModal = document.getElementById("addStaffModal");
    const btnOpenAddStaffModal = document.getElementById("btnOpenAddStaffModal");
    const closeAddStaffModalBtn = document.getElementById("closeAddStaffModalBtn");
    const cancelAddStaffModalBtn = document.getElementById("cancelAddStaffModalBtn");
    const addStaffForm = document.getElementById("addStaffForm");

    if (btnOpenAddStaffModal) btnOpenAddStaffModal.addEventListener("click", () => addStaffModal.style.display = "flex");
    function closeAddStaffModal() { if (addStaffModal) addStaffModal.style.display = "none"; }
    if (closeAddStaffModalBtn) closeAddStaffModalBtn.addEventListener("click", closeAddStaffModal);
    if (cancelAddStaffModalBtn) cancelAddStaffModalBtn.addEventListener("click", closeAddStaffModal);

    if (addStaffForm) {
        addStaffForm.addEventListener("submit", async function (e) {
            e.preventDefault();
            const name = document.getElementById("newStaffName").value.trim();
            const mobileInput = document.getElementById("newStaffMobile");
            const mobile = mobileInput ? mobileInput.value.trim() : "";
            const role = document.getElementById("newStaffRole").value.trim();
            const email = mobile ? `${mobile}@clinic.com` : `staff_${Date.now()}@clinic.com`;

            try {
                const { error } = await supabaseClient.from("staff").insert([{ name, email, role, mobile }]);
                if (error) {
                    // Fallback without mobile column if column does not exist yet
                    const { error: err2 } = await supabaseClient.from("staff").insert([{ name, email, role }]);
                    if (err2) throw err2;
                }

                if (typeof showToast === "function") showToast(`Staff member "${name}" (${role}) added successfully!`, "success");
                addStaffForm.reset();
                closeAddStaffModal();
                fetchStaffTeam();
            } catch (err) {
                console.error("Error adding staff:", err);
                if (typeof showToast === "function") showToast("Failed to add staff member: " + err.message, "error");
            }
        });
    }

    // REPORT UPLOADING & DELETE
    window.deleteAdminDoctorReport = async function(appId, reportIndex, event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }

        try {
            const parsedId = isNaN(Number(appId)) ? appId : Number(appId);
            let targetItem = allAppointments.find(a => String(a.id) === String(parsedId));

            if (!targetItem && supabaseClient) {
                const { data: dbRow } = await supabaseClient.from("appointments").select("*").eq("id", parsedId).maybeSingle();
                if (dbRow) targetItem = dbRow;
            }

            if (!targetItem) return;

            let currentReports = (typeof getAppointmentReports === "function") ? getAppointmentReports(targetItem) : [];
            const rName = (reportIndex >= 0 && reportIndex < currentReports.length) ? currentReports[reportIndex].name : "Report";

            if (reportIndex >= 0 && reportIndex < currentReports.length) {
                currentReports.splice(reportIndex, 1);
            }

            const updatedReports = currentReports.length > 0 ? currentReports : null;
            const updatedDoctorReportUrl = currentReports.length > 0 ? currentReports.map(r => `${r.url}|||${r.name}`).join(", ") : null;

            let { error: dbError } = await supabaseClient
                .from("appointments")
                .update({ doctor_reports: updatedReports, doctor_report_url: updatedDoctorReportUrl })
                .eq("id", parsedId);

            if (dbError) throw dbError;

            if (typeof showToast === "function") showToast(`Report "${rName}" deleted successfully!`, "success");
            fetchAllAppointments();

        } catch (err) {
            console.error("Delete report exception:", err);
        }
    };

    const uploadReportModal = document.getElementById("uploadReportModal");
    const closeUploadReportModal = document.getElementById("closeUploadReportModal");
    const cancelUploadReportBtn = document.getElementById("cancelUploadReportBtn");
    const uploadReportForm = document.getElementById("uploadReportForm");

    const reportTypeSelect = document.getElementById("reportTypeSelect");
    const reportNameInput = document.getElementById("reportNameInput");
    const reportFileInput = document.getElementById("reportFileInput");
    const reportFileNamePreview = document.getElementById("reportFileNamePreview");

    if (reportTypeSelect && reportNameInput) {
        reportTypeSelect.addEventListener("change", function () {
            if (this.value === "Other") {
                reportNameInput.style.display = "block";
                reportNameInput.required = true;
                reportNameInput.value = "";
                reportNameInput.focus();
            } else {
                reportNameInput.style.display = "none";
                reportNameInput.required = false;
                reportNameInput.value = this.value;
            }
        });
    }

    if (reportFileInput && reportFileNamePreview) {
        reportFileInput.addEventListener("change", function () {
            if (this.files && this.files.length > 0) {
                const file = this.files[0];
                const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
                reportFileNamePreview.innerHTML = `📄 <strong>Selected File:</strong> ${escapeHtml(file.name)} (${sizeMb} MB)`;
                reportFileNamePreview.style.display = "block";
            } else {
                reportFileNamePreview.textContent = "";
                reportFileNamePreview.style.display = "none";
            }
        });
    }

    function openUploadReportModal(appId, patientName) {
        if (!uploadReportModal) return;
        document.getElementById("uploadReportAppId").value = appId;
        document.getElementById("uploadReportPatientName").textContent = `Patient: ${patientName || '-'}`;
        if (reportTypeSelect) reportTypeSelect.value = "";
        if (reportNameInput) {
            reportNameInput.value = "";
            reportNameInput.style.display = "none";
            reportNameInput.required = false;
        }
        const reportDateInput = document.getElementById("reportDateInput");
        if (reportDateInput) {
            reportDateInput.value = new Date().toISOString().split("T")[0];
        }
        if (reportFileInput) reportFileInput.value = "";
        if (reportFileNamePreview) reportFileNamePreview.style.display = "none";
        uploadReportModal.style.display = "flex";
    }

    function closeUploadReportModalFunc() {
        if (uploadReportModal) uploadReportModal.style.display = "none";
    }

    if (closeUploadReportModal) closeUploadReportModal.addEventListener("click", closeUploadReportModalFunc);
    if (cancelUploadReportBtn) cancelUploadReportBtn.addEventListener("click", closeUploadReportModalFunc);

    if (uploadReportForm) {
        uploadReportForm.addEventListener("submit", async function (e) {
            e.preventDefault();
            const appId = document.getElementById("uploadReportAppId").value;
            const typeVal = reportTypeSelect ? reportTypeSelect.value : "";
            let reportName = "";
            if (typeVal === "Other") {
                reportName = reportNameInput ? reportNameInput.value.trim() : "";
            } else {
                reportName = typeVal;
            }
            const file = (reportFileInput && reportFileInput.files && reportFileInput.files.length > 0) ? reportFileInput.files[0] : null;

            const reportDateInput = document.getElementById("reportDateInput");
            const reportDateVal = reportDateInput ? reportDateInput.value : "";
            let formattedReportDate = "Date not recorded";
            if (reportDateVal) {
                const dateObj = new Date(reportDateVal + "T00:00:00");
                if (!isNaN(dateObj.getTime())) {
                    formattedReportDate = dateObj.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
                }
            }

            if (!typeVal || !reportName || !reportDateVal || !file) {
                if (typeof showToast === "function") showToast("Please fill all required fields (Name, Date, File).", "error");
                return;
            }

            const submitBtn = document.getElementById("submitUploadReportBtn");
            const submitBtnText = document.getElementById("submitUploadReportBtnText");
            if (submitBtn) submitBtn.disabled = true;
            if (submitBtnText) submitBtnText.textContent = "Uploading Report...";

            try {
                const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
                const filePath = `doc_report_${Date.now()}_${cleanFileName}`;

                const { error: uploadError } = await supabaseClient.storage.from("patient-documents").upload(filePath, file, { cacheControl: "3600", upsert: false });
                if (uploadError) throw uploadError;

                const { data: publicUrlData } = supabaseClient.storage.from("patient-documents").getPublicUrl(filePath);
                const publicUrl = publicUrlData ? publicUrlData.publicUrl : null;
                if (!publicUrl) throw new Error("Public URL unavailable");

                const parsedId = isNaN(Number(appId)) ? appId : Number(appId);
                let targetItem = allAppointments.find(a => String(a.id) === String(parsedId));
                let currentReports = (targetItem && typeof getAppointmentReports === "function") ? getAppointmentReports(targetItem) : [];
                
                const now = new Date();
                const uploadDateFormatted = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

                currentReports.push({ 
                    name: reportName, 
                    url: publicUrl,
                    report_date: formattedReportDate,
                    upload_date: uploadDateFormatted,
                    created_at: now.toISOString()
                });

                const updatedDoctorReportUrl = currentReports.map(r => `${r.url}|||${r.name}`).join(", ");

                let { error: dbError } = await supabaseClient.from("appointments").update({ 
                    doctor_reports: currentReports, 
                    doctor_report_url: updatedDoctorReportUrl,
                    report_date: reportDateVal || null
                }).eq("id", parsedId);

                if (dbError && (dbError.message.includes("report_date") || dbError.code === "PGRST204" || dbError.message.includes("schema cache"))) {
                    console.warn("report_date column missing in appointments table, falling back to doctor_reports update:", dbError.message);
                    const fallbackRes = await supabaseClient.from("appointments").update({
                        doctor_reports: currentReports,
                        doctor_report_url: updatedDoctorReportUrl
                    }).eq("id", parsedId);
                    dbError = fallbackRes.error;
                }

                if (dbError) throw dbError;

                if (typeof showToast === "function") showToast(`Report "${reportName}" uploaded successfully!`, "success");
                closeUploadReportModalFunc();
                fetchAllAppointments();

            } catch (err) {
                console.error("Report upload error:", err);
                if (typeof showToast === "function") showToast("Error uploading report: " + err.message, "error");
            } finally {
                if (submitBtn) submitBtn.disabled = false;
                if (submitBtnText) submitBtnText.textContent = "📤 Save & Upload";
            }
        });
    }

    // ==========================================
    // BUSINESS ANALYTICS FEATURE LOGIC
    // ==========================================
    function normalizeTime(t) {
        if (!t) return "";
        t = String(t).trim().toUpperCase();
        const match = t.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
        if (match) {
            let h = parseInt(match[1], 10);
            const m = match[2];
            let period = match[3];
            if (!period) {
                if (h === 0) { h = 12; period = "AM"; }
                else if (h < 12) { period = "AM"; }
                else if (h === 12) { period = "PM"; }
                else { h = h - 12; period = "PM"; }
            }
            const hStr = h < 10 ? "0" + h : "" + h;
            return `${hStr}:${m} ${period}`;
        }
        return t;
    }

    function renderBusinessAnalytics() {
        if (!allAppointments) return;

        // 1. Quick Stats Cards
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        let thisMonthCount = 0;
        let cancelledCount = 0;
        let completedCount = 0;
        const uniqueDatesSet = new Set();

        allAppointments.forEach(app => {
            if (app.status === "Cancelled") cancelledCount++;
            if (app.status === "Completed") completedCount++;

            if (app.appointment_date) {
                uniqueDatesSet.add(app.appointment_date);
                const appDate = new Date(app.appointment_date);
                if (!isNaN(appDate.getTime())) {
                    if (appDate.getMonth() === currentMonth && appDate.getFullYear() === currentYear) {
                        thisMonthCount++;
                    }
                }
            }
        });

        const totalApps = allAppointments.length;
        const cancelRate = totalApps > 0 ? ((cancelledCount / totalApps) * 100).toFixed(1) : "0.0";
        const uniqueDays = uniqueDatesSet.size || 1;
        const avgDaily = (totalApps / uniqueDays).toFixed(1);

        const elMonth = document.getElementById("analyticsStatMonthBookings");
        const elCancel = document.getElementById("analyticsStatCancelRate");
        const elAvg = document.getElementById("analyticsStatAvgDaily");
        const elComp = document.getElementById("analyticsStatCompletedTotal");

        if (elMonth) elMonth.textContent = thisMonthCount;
        if (elCancel) elCancel.textContent = cancelRate + "%";
        if (elAvg) elAvg.textContent = avgDaily;
        if (elComp) elComp.textContent = completedCount;

        // 2. Revenue Section
        renderRevenueSection();

        // 3. Doctor-wise Performance Table
        renderDoctorPerformanceTable();

        // 4. Busiest Days & Popular Slots
        renderBusiestDays();
        renderPopularTimeSlots();
    }

    function renderRevenueSection() {
        const contentArea = document.getElementById("revenueContentArea");
        const filterSelect = document.getElementById("revenueTimeFilter");
        if (!contentArea) return;

        const filterVal = filterSelect ? filterSelect.value : "all";

        // Check if any appointment has an 'amount' or 'billing_amount' column with numeric value
        const hasAmountColumn = allAppointments.some(a => 
            (a.amount !== undefined && a.amount !== null && a.amount !== "") ||
            (a.billing_amount !== undefined && a.billing_amount !== null && a.billing_amount !== "")
        );

        if (!hasAmountColumn) {
            contentArea.innerHTML = `
                <div style="background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 12px; padding: 24px; text-align: center;">
                    <div style="font-size: 2.2rem; margin-bottom: 8px;">💳</div>
                    <h4 style="font-size: 1.05rem; font-weight: 700; color: #334155; margin: 0 0 6px 0;">Revenue tracking not set up yet</h4>
                    <p style="font-size: 0.85rem; color: #64748b; margin: 0 auto; max-width: 460px;">
                        Billing and amount tracking feature is not configured in appointment database records yet. All clinic bookings are currently tracked without revenue figures.
                    </p>
                </div>
            `;
            return;
        }

        // Calculate Revenue for Completed appointments
        const now = new Date();
        let totalRevenue = 0;
        let completedInFilter = 0;

        allAppointments.forEach(app => {
            if (app.status !== "Completed") return;
            const val = Number(app.amount || app.billing_amount || 0);
            if (val <= 0) return;

            if (!app.appointment_date) return;
            const appDate = new Date(app.appointment_date);
            if (isNaN(appDate.getTime())) return;

            if (filterVal === "month") {
                if (appDate.getMonth() !== now.getMonth() || appDate.getFullYear() !== now.getFullYear()) return;
            } else if (filterVal === "week") {
                const oneWeekAgo = new Date();
                oneWeekAgo.setDate(now.getDate() - 7);
                if (appDate < oneWeekAgo) return;
            }

            totalRevenue += val;
            completedInFilter++;
        });

        contentArea.innerHTML = `
            <div style="background: linear-gradient(135deg, #0f766e 0%, #0d9488 100%); color: white; padding: 24px; border-radius: 14px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
                <div>
                    <div style="font-size: 0.88rem; opacity: 0.9; font-weight: 600;">Total Revenue Generated (${filterVal === "month" ? "This Month" : filterVal === "week" ? "This Week" : "All Time"})</div>
                    <div style="font-size: 2.2rem; font-weight: 800; margin-top: 4px;">₹ ${totalRevenue.toLocaleString("en-IN")}</div>
                </div>
                <div style="background: rgba(255,255,255,0.15); backdrop-filter: blur(4px); padding: 12px 20px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.2);">
                    <div style="font-size: 0.82rem; opacity: 0.9;">Completed Patient Visits</div>
                    <div style="font-size: 1.4rem; font-weight: 700;">${completedInFilter} Patients</div>
                </div>
            </div>
        `;
    }

    function renderDoctorPerformanceTable() {
        const tbody = document.getElementById("doctorPerformanceTableBody");
        if (!tbody) return;

        if (!doctorsList || doctorsList.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="padding: 16px; text-align: center; color: #94a3b8;">No registered doctor records available</td></tr>`;
            return;
        }

        const docStats = {};
        doctorsList.forEach(d => {
            docStats[d.id] = {
                id: d.id,
                name: d.name,
                specialization: d.specialization || "Dental Specialist",
                total: 0,
                completed: 0,
                cancelled: 0
            };
        });

        allAppointments.forEach(app => {
            if (app.doctor_id && docStats[app.doctor_id]) {
                docStats[app.doctor_id].total++;
                if (app.status === "Completed") docStats[app.doctor_id].completed++;
                if (app.status === "Cancelled") docStats[app.doctor_id].cancelled++;
            }
        });

        let html = "";
        Object.values(docStats).forEach(ds => {
            const rate = ds.total > 0 ? Math.round((ds.completed / ds.total) * 100) : 0;
            let rateClass = "background: #f1f5f9; color: #475569;";
            if (rate >= 70) rateClass = "background: #dcfce7; color: #15803d;";
            else if (rate >= 40) rateClass = "background: #fef9c3; color: #a16207;";

            let cleanName = ds.name || "Doctor";
            if (!/^dr\.?\s+/i.test(cleanName)) cleanName = "Dr. " + cleanName;

            html += `
                <tr style="border-bottom: 1px solid #f1f5f9; font-size: 0.9rem;">
                    <td style="padding: 12px 10px; font-weight: 700; color: #1e293b;">
                        👨‍⚕️ ${escapeHtml(cleanName)}
                    </td>
                    <td style="padding: 12px 10px; color: #64748b; font-size: 0.85rem;">
                        ${escapeHtml(ds.specialization)}
                    </td>
                    <td style="padding: 12px 10px; text-align: center; font-weight: 700; color: #1e293b;">
                        ${ds.total}
                    </td>
                    <td style="padding: 12px 10px; text-align: center; color: #059669; font-weight: 700;">
                        ${ds.completed}
                    </td>
                    <td style="padding: 12px 10px; text-align: center; color: #e11d48; font-weight: 700;">
                        ${ds.cancelled}
                    </td>
                    <td style="padding: 12px 10px; text-align: center;">
                        <span style="padding: 4px 12px; border-radius: 12px; font-size: 0.82rem; font-weight: 700; ${rateClass}">
                            ${rate}%
                        </span>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    }

    function renderBusiestDays() {
        const container = document.getElementById("busiestDaysContainer");
        if (!container) return;

        const daysMap = {
            "Monday": 0, "Tuesday": 0, "Wednesday": 0, "Thursday": 0, "Friday": 0, "Saturday": 0, "Sunday": 0
        };
        const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

        let totalCount = 0;
        allAppointments.forEach(app => {
            if (!app.appointment_date) return;
            const d = new Date(app.appointment_date);
            if (!isNaN(d.getTime())) {
                const dayName = dayNames[d.getDay()];
                if (daysMap[dayName] !== undefined) {
                    daysMap[dayName]++;
                    totalCount++;
                }
            }
        });

        let html = "";
        const order = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
        order.forEach(day => {
            const count = daysMap[day];
            const pct = totalCount > 0 ? Math.round((count / totalCount) * 100) : 0;
            html += `
                <div>
                    <div style="display: flex; justify-content: space-between; font-size: 0.85rem; font-weight: 600; color: #334155; margin-bottom: 4px;">
                        <span>📅 ${day}</span>
                        <span>${count} bookings (${pct}%)</span>
                    </div>
                    <div style="background: #f1f5f9; height: 8px; border-radius: 4px; overflow: hidden;">
                        <div style="background: linear-gradient(90deg, #0d9488, #0284c7); height: 100%; width: ${pct}%; border-radius: 4px; transition: width 0.3s ease;"></div>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    function renderPopularTimeSlots() {
        const container = document.getElementById("popularTimeSlotsContainer");
        if (!container) return;

        const timeMap = {};
        let totalCount = 0;

        allAppointments.forEach(app => {
            if (!app.appointment_time) return;
            const normTime = normalizeTime(app.appointment_time);
            if (!normTime) return;

            timeMap[normTime] = (timeMap[normTime] || 0) + 1;
            totalCount++;
        });

        const sortedSlots = Object.entries(timeMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        if (sortedSlots.length === 0) {
            container.innerHTML = `<div style="font-size: 0.85rem; color: #94a3b8; text-align: center; padding: 12px;">No time slot data available</div>`;
            return;
        }

        let html = "";
        sortedSlots.forEach(([time, count]) => {
            const pct = totalCount > 0 ? Math.round((count / totalCount) * 100) : 0;
            html += `
                <div>
                    <div style="display: flex; justify-content: space-between; font-size: 0.85rem; font-weight: 600; color: #334155; margin-bottom: 4px;">
                        <span>⏰ ${escapeHtml(time)}</span>
                        <span>${count} bookings (${pct}%)</span>
                    </div>
                    <div style="background: #f1f5f9; height: 8px; border-radius: 4px; overflow: hidden;">
                        <div style="background: linear-gradient(90deg, #6366f1, #8b5cf6); height: 100%; width: ${pct}%; border-radius: 4px; transition: width 0.3s ease;"></div>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    // Patient Report History Handler
    function renderPatientReportHistory(searchQuery = "") {
        const resultsContainer = document.getElementById("patientHistoryResultsContainer");
        if (!resultsContainer) return;

        const query = (searchQuery || "").trim().toLowerCase();

        // 1. Gather all reports across all appointments
        const patientMap = {};

        (allAppointments || []).forEach(app => {
            const pName = (app.patient_name || "").trim();
            const pPhone = (app.phone_number || "").trim();

            if (!pName && !pPhone) return;

            const reports = (typeof getAppointmentReports === "function") ? getAppointmentReports(app) : [];
            if (reports.length === 0) return;

            const mapKey = (pPhone ? pPhone : pName.toLowerCase()).replace(/\s+/g, "");

            if (!patientMap[mapKey]) {
                patientMap[mapKey] = {
                    patientName: pName || "Unknown Patient",
                    phone: pPhone || "N/A",
                    reports: []
                };
            }

            reports.forEach(r => {
                const dateStr = (typeof formatReportDate === 'function') 
                    ? formatReportDate(r.report_date || r.upload_date) 
                    : (r.report_date || r.upload_date || 'Date not recorded');
                patientMap[mapKey].reports.push({
                    reportName: r.name || 'Medical Report',
                    reportUrl: r.url,
                    uploadDate: dateStr,
                    createdAt: r.created_at || app.created_at || app.appointment_date || '',
                    doctorName: app.doctor_name || (app.doctors && app.doctors.name ? app.doctors.name : 'General Dentist'),
                    issue: app.issue || 'General Consultation',
                    appDate: app.appointment_date || ''
                });
            });
        });

        // 2. Filter patient groups based on query
        let matchedPatients = Object.values(patientMap);

        if (query) {
            matchedPatients = matchedPatients.filter(p => 
                p.patientName.toLowerCase().includes(query) || 
                p.phone.toLowerCase().includes(query)
            );
        }

        if (matchedPatients.length === 0) {
            resultsContainer.innerHTML = `
                <div style="background: white; border-radius: 12px; padding: 48px 24px; text-align: center; border: 1px solid var(--border); box-shadow: var(--shadow-sm);">
                    <div style="font-size: 3rem; margin-bottom: 12px;">🔍</div>
                    <h3 style="margin: 0 0 8px 0; font-size: 1.15rem; color: var(--text);">No Patient Reports Found</h3>
                    <p style="margin: 0; font-size: 0.9rem; color: var(--text-muted);">
                        ${query ? `No medical reports matching "${escapeHtml(query)}" were found.` : 'No patient medical reports have been uploaded yet.'}
                    </p>
                </div>
            `;
            return;
        }

        // 3. Sort each patient's reports by date descending
        matchedPatients.forEach(p => {
            p.reports.sort((a, b) => {
                const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                return timeB - timeA;
            });
        });

        // Sort patient list by newest report date descending
        matchedPatients.sort((a, b) => {
            const newestA = a.reports[0]?.createdAt ? new Date(a.reports[0].createdAt).getTime() : 0;
            const newestB = b.reports[0]?.createdAt ? new Date(b.reports[0].createdAt).getTime() : 0;
            return newestB - newestA;
        });

        // 4. Render output HTML
        let html = '';
        matchedPatients.forEach(p => {
            html += `
                <div style="background: white; border-radius: 14px; padding: 22px; margin-bottom: 20px; border: 1px solid var(--border); box-shadow: var(--shadow-sm);">
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f1f5f9; padding-bottom: 14px; margin-bottom: 18px; flex-wrap: wrap; gap: 10px;">
                        <div>
                            <h3 style="margin: 0; font-size: 1.15rem; color: var(--text); display: flex; align-items: center; gap: 8px;">
                                <span style="background: var(--primary-light); color: var(--primary); width: 34px; height: 34px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 0.95rem; font-weight: 700;">👤</span>
                                <strong>${escapeHtml(p.patientName)}</strong>
                            </h3>
                            <div style="font-size: 0.88rem; color: var(--text-muted); margin-top: 4px; margin-left: 42px;">
                                📱 Mobile: <strong>${escapeHtml(p.phone)}</strong>
                            </div>
                        </div>
                        <span style="background: #e0f2fe; color: #0369a1; padding: 5px 14px; border-radius: 20px; font-size: 0.85rem; font-weight: 700;">
                            ${p.reports.length} ${p.reports.length === 1 ? 'Report' : 'Reports'} Total
                        </span>
                    </div>

                    <div style="display: flex; flex-direction: column; gap: 12px;">
            `;

            p.reports.forEach(r => {
                html += `
                    <div style="display: flex; align-items: center; justify-content: space-between; background: #f8fafc; padding: 14px 18px; border-radius: 10px; border-left: 4px solid var(--primary); flex-wrap: wrap; gap: 12px;">
                        <div style="flex: 1; min-width: 250px;">
                            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                                <span style="background: #e0e7ff; color: #3730a3; padding: 3px 10px; border-radius: 6px; font-size: 0.82rem; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;">
                                    📅 ${escapeHtml(r.uploadDate)}
                                </span>
                                <span style="font-size: 1.05rem; font-weight: 700; color: var(--text);">
                                    ${escapeHtml(r.reportName)}
                                </span>
                            </div>
                            <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 6px; display: flex; gap: 12px; flex-wrap: wrap;">
                                <span>👨‍⚕️ <strong>Doctor:</strong> ${escapeHtml(r.doctorName)}</span>
                                <span>•</span>
                                <span>📋 <strong>Visit/Issue:</strong> ${escapeHtml(r.issue)} ${r.appDate ? `(${escapeHtml(r.appDate)})` : ''}</span>
                            </div>
                        </div>
                        <div style="display: flex; gap: 8px;">
                            <a href="${r.reportUrl}" target="_blank" class="btn btn-sm btn-outline-primary" style="text-decoration: none; padding: 6px 14px; font-size: 0.85rem; display: inline-flex; align-items: center; gap: 4px; border-radius: 8px;">
                                👁️ View
                            </a>
                            <a href="${r.reportUrl}" download target="_blank" class="btn btn-sm btn-primary" style="text-decoration: none; padding: 6px 14px; font-size: 0.85rem; display: inline-flex; align-items: center; gap: 4px; border-radius: 8px;">
                                📥 Download
                            </a>
                        </div>
                    </div>
                `;
            });

            html += `
                    </div>
                </div>
            `;
        });

        resultsContainer.innerHTML = html;
    }

    const patientHistorySearchInput = document.getElementById("patientHistorySearchInput");
    const patientHistorySearchBtn = document.getElementById("patientHistorySearchBtn");

    if (patientHistorySearchInput) {
        patientHistorySearchInput.addEventListener("input", function () {
            renderPatientReportHistory(this.value);
        });
    }

    if (patientHistorySearchBtn) {
        patientHistorySearchBtn.addEventListener("click", function () {
            const val = patientHistorySearchInput ? patientHistorySearchInput.value : "";
            renderPatientReportHistory(val);
        });
    }

    function setupRealtimeAdmin() {
        if (!supabaseClient) return;
        supabaseClient.channel('admin-appointments-realtime').on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => fetchAllAppointments()).subscribe();
    }

    checkAuthSession();
    setupRealtimeAdmin();
});
