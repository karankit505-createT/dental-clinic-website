// ==========================================
// ADMIN PORTAL LOGIC (admin.js - Admin Only)
// ==========================================

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
    const tabBtnAnalytics = document.getElementById("tabBtnAnalytics");

    const appointmentsTabSection = document.getElementById("appointmentsTabSection");
    const manageTeamTabSection = document.getElementById("manageTeamTabSection");
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

    if (supabaseClient) {
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
    }

    function showDashboardState() {
        if (loginState) loginState.style.display = "none";
        if (dashboardState) dashboardState.style.display = "block";
        if (logoutBtn) logoutBtn.style.display = "inline-flex";
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
        [tabBtnAppointments, tabBtnManageTeam, tabBtnAnalytics].forEach(btn => {
            if (btn) {
                btn.classList.remove("active");
                btn.style.color = "var(--text-muted)";
                btn.style.borderBottom = "none";
            }
        });
        if (appointmentsTabSection) appointmentsTabSection.style.display = "none";
        if (manageTeamTabSection) manageTeamTabSection.style.display = "none";
        if (analyticsTabSection) analyticsTabSection.style.display = "none";
    }

    if (tabBtnAppointments) {
        tabBtnAppointments.addEventListener("click", function () {
            resetTabStyles();
            tabBtnAppointments.classList.add("active");
            tabBtnAppointments.style.color = "var(--primary)";
            tabBtnAppointments.style.borderBottom = "3px solid var(--primary)";
            if (appointmentsTabSection) appointmentsTabSection.style.display = "block";
        });
    }

    if (tabBtnManageTeam) {
        tabBtnManageTeam.addEventListener("click", function () {
            resetTabStyles();
            tabBtnManageTeam.classList.add("active");
            tabBtnManageTeam.style.color = "var(--primary)";
            tabBtnManageTeam.style.borderBottom = "3px solid var(--primary)";
            if (manageTeamTabSection) manageTeamTabSection.style.display = "block";
            fetchTeamLists();
        });
    }

    if (tabBtnAnalytics) {
        tabBtnAnalytics.addEventListener("click", function () {
            resetTabStyles();
            tabBtnAnalytics.classList.add("active");
            tabBtnAnalytics.style.color = "var(--primary)";
            tabBtnAnalytics.style.borderBottom = "3px solid var(--primary)";
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
        if (docData && docData.name) {
            let n = docData.name.trim();
            return /^dr\.?\s+/i.test(n) ? n : "Dr. " + n;
        }
        if (doctorId) {
            const found = doctorsList.find(d => String(d.id) === String(doctorId));
            if (found && found.name) {
                let n = found.name.trim();
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

        } catch (err) {
            console.error("Fetch appointments exception:", err);
        }
    }

    function updateStatsCounters() {
        const totalAppointments = allAppointments.length;
        const completedApps = allAppointments.filter(a => a.status === "Completed");
        const totalCompleted = completedApps.length;

        let withReportsCount = 0;
        completedApps.forEach(item => {
            const reports = (typeof getAppointmentReports === "function") ? getAppointmentReports(item) : [];
            if (reports.length > 0) withReportsCount++;
        });

        const pendingReportsCount = totalCompleted - withReportsCount;

        if (statTotal) statTotal.textContent = totalAppointments;
        if (statCompleted) statCompleted.textContent = totalCompleted;
        if (statWithReports) statWithReports.textContent = withReportsCount;
        if (statPendingReports) statPendingReports.textContent = pendingReportsCount;
    }

    function applyClientFilters() {
        let filtered = [...allAppointments];

        if (filterDate && filterDate.value) {
            filtered = filtered.filter(item => item.appointment_date === filterDate.value);
        }
        if (filterStatus && filterStatus.value !== "All") {
            filtered = filtered.filter(item => item.status === filterStatus.value);
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
            const tr = document.createElement("tr");

            const dropdownId = `adminReportDropdown-${item.id}`;
            const existingReports = (typeof getAppointmentReports === "function") ? getAppointmentReports(item) : [];

            let reportDropdownHtml = "";
            if (existingReports.length > 0) {
                const reportItemsHtml = existingReports.map((r, rIndex) => {
                    return `
                        <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 6px 10px; border-bottom: 1px solid #f1f5f9; background: white;">
                            <button type="button" onclick="event.stopPropagation(); if(typeof viewPatientDocument==='function'){viewPatientDocument('${escapeHtml(r.url)}', '${escapeHtml(item.patient_name)}_${escapeHtml(r.name)}')}else{window.open('${escapeHtml(r.url)}', '_blank')}" style="padding: 4px 8px; font-size: 0.76rem; background: #e0f2fe; color: #0284c7; border: 1px solid #bae6fd; border-radius: 5px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; flex: 1; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="View ${escapeHtml(r.name)}">
                                👁️ ${escapeHtml(r.name)}
                            </button>
                            <button type="button" onclick="deleteAdminDoctorReport('${item.id}', ${rIndex}, event)" class="btn-delete-report" style="padding: 4px 6px; font-size: 0.8rem; background: #ffe4e6; color: #be123c; border: 1px solid #fecdd3; border-radius: 5px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; flex-shrink: 0;" title="Delete report">
                                🗑️
                            </button>
                        </div>
                    `;
                }).join("");

                reportDropdownHtml = `
                    <div style="position: relative; display: inline-block;">
                        <button type="button" class="btn-toggle-reports-dropdown" data-target="${dropdownId}" style="padding: 5px 10px; font-size: 0.75rem; background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; border-radius: 6px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; white-space: nowrap;">
                            📄 Reports (${existingReports.length}) <span style="font-size: 0.65rem;">▾</span>
                        </button>
                        <div id="${dropdownId}" class="reports-dropdown-menu" style="display: none; position: absolute; right: 0; top: calc(100% + 4px); background: white; border: 1px solid #cbd5e1; border-radius: 8px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); width: 230px; z-index: 99; overflow: hidden;">
                            ${reportItemsHtml}
                        </div>
                    </div>
                `;
            }

            let adminReportActionHtml = "";

            if (item.status === "Completed") {
                const uploadBtnLabel = existingReports.length > 0 ? "➕ Add Report" : "📤 Upload Report";
                adminReportActionHtml = `
                    <div style="display: flex; flex-direction: column; gap: 6px; align-items: flex-start;">
                        <button type="button" class="btn-open-upload-modal" data-id="${item.id}" data-name="${escapeHtml(item.patient_name)}" style="padding: 6px 12px; font-size: 0.78rem; background: linear-gradient(135deg, #0f766e 0%, #0d9488 100%); color: white; border: none; border-radius: 6px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; white-space: nowrap;">
                            ${uploadBtnLabel}
                        </button>
                        ${reportDropdownHtml}
                    </div>
                `;
            } else if (item.status === "Cancelled") {
                adminReportActionHtml = `<span style="font-size: 0.78rem; color: #9f1239; font-weight: 600; background: #ffe4e6; padding: 4px 10px; border-radius: 6px; border: 1px solid #fecdd3;">🚫 Cancelled</span>`;
            } else {
                adminReportActionHtml = `<span style="font-size: 0.78rem; color: #64748b; font-weight: 600; background: #f1f5f9; padding: 4px 10px; border-radius: 6px; border: 1px solid #cbd5e1;">⏳ Checkup Pending</span>`;
            }

            let statusBadgeHtml = "";
            if (item.status === "Completed") {
                statusBadgeHtml = `<span style="background: var(--status-completed-bg); color: var(--status-completed-text); border: 1px solid var(--status-completed-border); padding: 4px 10px; border-radius: 20px; font-weight: 700; font-size: 0.78rem;">✅ Completed</span>`;
            } else if (item.status === "Confirmed") {
                statusBadgeHtml = `<span style="background: var(--status-confirmed-bg); color: var(--status-confirmed-text); border: 1px solid var(--status-confirmed-border); padding: 4px 10px; border-radius: 20px; font-weight: 700; font-size: 0.78rem;">📅 Confirmed</span>`;
            } else if (item.status === "Cancelled") {
                statusBadgeHtml = `<span style="background: var(--status-cancelled-bg); color: var(--status-cancelled-text); border: 1px solid var(--status-cancelled-border); padding: 4px 10px; border-radius: 20px; font-weight: 700; font-size: 0.78rem;">❌ Cancelled</span>`;
            } else {
                statusBadgeHtml = `<span style="background: var(--status-pending-bg); color: var(--status-pending-text); border: 1px solid var(--status-pending-border); padding: 4px 10px; border-radius: 20px; font-weight: 700; font-size: 0.78rem;">⏳ Pending</span>`;
            }

            const formattedDate = item.appointment_date || "-";
            const formattedTime = (typeof formatTime12Hour === "function") ? formatTime12Hour(item.appointment_time) : (item.appointment_time || "-");

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
                <td><strong>#${index + 1}</strong></td>
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
                    <div style="font-weight: 600; color: #1e293b;">📅 ${formattedDate}</div>
                    <div style="font-size: 0.8rem; color: #0284c7; font-weight: 700;">⏰ ${formattedTime}</div>
                </td>
                <td>
                    <div style="max-width: 170px; font-size: 0.85rem; color: #334155; line-height: 1.4; word-break: break-word;">
                        ${escapeHtml(issueDisplay)}
                    </div>
                </td>
                <td>${statusBadgeHtml}</td>
                <td>${adminReportActionHtml}</td>
                <td>${adminActionsHtml}</td>
            `;

            tableBody.appendChild(tr);
        });

        // Toggle dropdown listener
        document.querySelectorAll(".btn-toggle-reports-dropdown").forEach(btn => {
            btn.addEventListener("click", function (e) {
                e.stopPropagation();
                const targetId = this.getAttribute("data-target");
                const menu = document.getElementById(targetId);
                document.querySelectorAll(".reports-dropdown-menu").forEach(m => {
                    if (m.id !== targetId) m.style.display = "none";
                });
                if (menu) menu.style.display = menu.style.display === "none" ? "block" : "none";
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
        document.getElementById("editTime").value = item.appointment_time || "";
        document.getElementById("editIssue").value = item.issue || "";
        
        const statusSelect = document.getElementById("editStatusSelect");
        if (statusSelect) statusSelect.value = item.status || "Pending";

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
            const status = document.getElementById("editStatusSelect").value;
            const appointment_date = document.getElementById("editDate").value;
            const appointment_time = document.getElementById("editTime").value.trim();
            const issue = document.getElementById("editIssue").value.trim();

            try {
                const { error } = await supabaseClient
                    .from("appointments")
                    .update({
                        patient_name,
                        mobile,
                        doctor_id: doctor_id || null,
                        status,
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
            data.forEach((doc, idx) => {
                const tr = document.createElement("tr");
                const regDate = doc.created_at ? doc.created_at.split('T')[0] : '-';
                tr.innerHTML = `
                    <td><strong>#${idx + 1}</strong></td>
                    <td><strong style="color: #0d9488;">${escapeHtml(doc.name)}</strong></td>
                    <td><span style="background: #e0f2fe; color: #0284c7; padding: 4px 10px; border-radius: 6px; font-size: 0.8rem; font-weight: 700;">${escapeHtml(doc.specialization || 'General')}</span></td>
                    <td>${escapeHtml(doc.email || '-')}</td>
                    <td>${regDate}</td>
                `;
                tbody.appendChild(tr);
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
            data.forEach((st, idx) => {
                const tr = document.createElement("tr");
                const regDate = st.created_at ? st.created_at.split('T')[0] : '-';
                const roleBadge = st.role === "Admin"
                    ? `<span style="background: #e0f2fe; color: #0369a1; padding: 4px 10px; border-radius: 6px; font-size: 0.8rem; font-weight: 700;">🛡️ Admin</span>`
                    : `<span style="background: #f0fdf4; color: #0d9488; padding: 4px 10px; border-radius: 6px; font-size: 0.8rem; font-weight: 700;">📋 Receptionist</span>`;

                tr.innerHTML = `
                    <td><strong>#${idx + 1}</strong></td>
                    <td><strong>${escapeHtml(st.name)}</strong></td>
                    <td>${escapeHtml(st.email)}</td>
                    <td>${roleBadge}</td>
                    <td>${regDate}</td>
                `;
                tbody.appendChild(tr);
            });
        } catch (e) {
            console.error("Error fetching staff team:", e);
        }
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
            const email = document.getElementById("newDoctorEmail").value.trim();

            try {
                const { error } = await supabaseClient.from("doctors").insert([{ name, specialization, email }]);
                if (error) throw error;

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
            const email = document.getElementById("newStaffEmail").value.trim();
            const role = document.getElementById("newStaffRole").value;

            try {
                const { error } = await supabaseClient.from("staff").insert([{ name, email, role }]);
                if (error) throw error;

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
            if (this.value && this.value !== "Other") reportNameInput.value = this.value;
            else if (this.value === "Other") { reportNameInput.value = ""; reportNameInput.focus(); }
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
        if (reportNameInput) reportNameInput.value = "";
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
            const reportName = reportNameInput ? reportNameInput.value.trim() : "";
            const file = (reportFileInput && reportFileInput.files && reportFileInput.files.length > 0) ? reportFileInput.files[0] : null;

            if (!reportName || !file) {
                if (typeof showToast === "function") showToast("Please select a report name and file.", "error");
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
                currentReports.push({ name: reportName, url: publicUrl });

                const updatedDoctorReportUrl = currentReports.map(r => `${r.url}|||${r.name}`).join(", ");

                const { error: dbError } = await supabaseClient.from("appointments").update({ doctor_reports: currentReports, doctor_report_url: updatedDoctorReportUrl }).eq("id", parsedId);
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

    function setupRealtimeAdmin() {
        if (!supabaseClient) return;
        supabaseClient.channel('admin-appointments-realtime').on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => fetchAllAppointments()).subscribe();
    }

    checkAuthSession();
    setupRealtimeAdmin();
});
