// ==========================================
// STAFF & RECEPTIONIST PORTAL LOGIC (staff.js)
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
    const filterDoctor = document.getElementById("filterDoctor");
    const filterSearch = document.getElementById("filterSearch");

    const statCompleted = document.getElementById("statCompleted");
    const statWithReports = document.getElementById("statWithReports");
    const statPendingReports = document.getElementById("statPendingReports");

    const staffWelcomeName = document.getElementById("staffWelcomeName");

    let completedAppointments = [];
    let doctorsList = [];
    let currentStaff = null;

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
            if (loginBtnText) loginBtnText.textContent = "Authenticating Staff...";
        } else {
            loginBtn.disabled = false;
            loginBtn.classList.remove("loading");
            if (loginBtnText) loginBtnText.textContent = "Staff Login";
        }
    }

    async function loadStaffProfile(email, createIfMissing = false, defaultRole = "Receptionist") {
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

            // Auto-create Staff profile if valid Auth user and allowed
            if (createIfMissing) {
                const rawName = cleanEmail.split("@")[0].replace(/[^a-zA-Z0-9]/g, " ");
                const formattedName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
                const { data: newStaff, error: insertErr } = await supabaseClient
                    .from("staff")
                    .insert([{
                        name: (formattedName || "Staff") + " Staff",
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
            if (staffWelcomeName) staffWelcomeName.textContent = "Staff Member";
            return;
        }
        const cleanName = String(staff.name || "Staff").trim();
        if (staffWelcomeName) staffWelcomeName.textContent = cleanName;
    }

    function clearAllStoredData() {
        sessionStorage.clear();
        localStorage.clear();
        sessionStorage.removeItem("loggedInStaff");
        localStorage.removeItem("loggedInStaff");
        currentStaff = null;
        completedAppointments = [];
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
                if (staffProfile) {
                    currentStaff = staffProfile;
                    sessionStorage.setItem("loggedInStaff", JSON.stringify(currentStaff));
                    updateStaffHeader(currentStaff);
                    showDashboardState();
                    await fetchDoctorsList();
                    fetchCompletedAppointments();
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
                if (staffProfile) {
                    currentStaff = staffProfile;
                    sessionStorage.setItem("loggedInStaff", JSON.stringify(currentStaff));
                    updateStaffHeader(currentStaff);
                    showDashboardState();
                    await fetchDoctorsList();
                    fetchCompletedAppointments();
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

        const emailInput = document.getElementById("staffEmail");
        const passInput = document.getElementById("staffPassword");
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

            const email = document.getElementById("staffEmail").value.trim();
            const password = document.getElementById("staffPassword").value.trim();

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
                    throw new Error("Invalid staff email or password. Please try again.");
                }

                const staffProfile = await loadStaffProfile(data.user.email || email, true, "Receptionist");
                if (!staffProfile) {
                    await supabaseClient.auth.signOut();
                    throw new Error("Access Denied: Email is not registered as clinic staff.");
                }

                currentStaff = staffProfile;
                sessionStorage.setItem("loggedInStaff", JSON.stringify(currentStaff));
                updateStaffHeader(currentStaff);
                showDashboardState();
                await fetchDoctorsList();
                fetchCompletedAppointments();

                if (typeof showToast === "function") {
                    showToast(`Logged in successfully as ${currentStaff.name} (${currentStaff.role})!`, "success");
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

    // Fetch Doctors List
    async function fetchDoctorsList() {
        if (!supabaseClient) return;
        try {
            const { data, error } = await supabaseClient.from("doctors").select("*").order("name");
            if (!error && data) {
                doctorsList = data;
                populateDoctorFilterDropdown();
                populatePhoneDoctorSelect();
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

    function populatePhoneDoctorSelect() {
        const phoneDoctorSelect = document.getElementById("phoneDoctorSelect");
        if (!phoneDoctorSelect) return;
        phoneDoctorSelect.innerHTML = `<option value="">-- Select Doctor --</option>`;
        doctorsList.forEach(doc => {
            const opt = document.createElement("option");
            opt.value = doc.id;
            let cleanName = doc.name || "Doctor";
            if (!/^dr\.?\s+/i.test(cleanName)) cleanName = "Dr. " + cleanName;
            opt.textContent = `${cleanName} (${doc.specialization || 'General'})`;
            phoneDoctorSelect.appendChild(opt);
        });
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

    // Fetch ONLY Completed Appointments for Staff Report Uploads
    async function fetchCompletedAppointments() {
        if (!supabaseClient) return;

        try {
            if (tableBody) {
                tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 24px; color: var(--text-muted);">Loading completed appointments...</td></tr>`;
            }

            const { data, error } = await supabaseClient
                .from("appointments")
                .select("*, doctors(id, name, specialization)")
                .eq("status", "Completed")
                .order("appointment_date", { ascending: false });

            if (error) {
                console.error("Error fetching completed appointments:", error);
                if (typeof showToast === "function") showToast("Failed to load appointments: " + error.message, "error");
                return;
            }

            completedAppointments = data || [];
            updateStatsCounters();
            applyClientFilters();

        } catch (err) {
            console.error("Fetch completed appointments exception:", err);
        }
    }

    function updateStatsCounters() {
        const totalCompleted = completedAppointments.length;
        let withReportsCount = 0;

        completedAppointments.forEach(item => {
            const reports = (typeof getAppointmentReports === "function") ? getAppointmentReports(item) : [];
            if (reports.length > 0) withReportsCount++;
        });

        const pendingReportsCount = totalCompleted - withReportsCount;

        if (statCompleted) statCompleted.textContent = totalCompleted;
        if (statWithReports) statWithReports.textContent = withReportsCount;
        if (statPendingReports) statPendingReports.textContent = pendingReportsCount;
    }

    function applyClientFilters() {
        let filtered = [...completedAppointments];

        if (filterDate && filterDate.value) {
            filtered = filtered.filter(item => item.appointment_date === filterDate.value);
        }

        if (filterDoctor && filterDoctor.value !== "All") {
            const selectedDocId = filterDoctor.value;
            filtered = filtered.filter(item => String(item.doctor_id) === String(selectedDocId));
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
    if (filterDoctor) filterDoctor.addEventListener("change", applyClientFilters);
    if (filterSearch) filterSearch.addEventListener("input", applyClientFilters);

    // Render Completed Appointments Table
    function renderAppointmentsTable(list) {
        if (!tableBody) return;

        tableBody.innerHTML = "";

        if (list.length === 0) {
            if (emptyState) emptyState.style.display = "block";
            if (emptyStateText) emptyStateText.textContent = "No completed appointments match your filter criteria";
            if (appointmentsTable) appointmentsTable.style.display = "none";
            return;
        }

        if (emptyState) emptyState.style.display = "none";
        if (appointmentsTable) appointmentsTable.style.display = "table";

        list.forEach((item, index) => {
            const tr = document.createElement("tr");

            const dropdownId = `staffReportDropdown-${item.id}`;
            const existingReports = (typeof getAppointmentReports === "function") ? getAppointmentReports(item) : [];

            let reportDropdownHtml = "";
            if (existingReports.length > 0) {
                const reportItemsHtml = existingReports.map((r, rIndex) => {
                    const dateDisplay = r.report_date || r.upload_date || "Date not recorded";
                    const labelWithDate = `${r.name} (${dateDisplay})`;
                    return `
                        <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 6px 10px; border-bottom: 1px solid #f1f5f9; background: white;">
                            <button type="button" onclick="event.stopPropagation(); if(typeof viewPatientDocument==='function'){viewPatientDocument('${escapeHtml(r.url)}', '${escapeHtml(item.patient_name)}_${escapeHtml(r.name)}')}else{window.open('${escapeHtml(r.url)}', '_blank')}" style="padding: 4px 8px; font-size: 0.76rem; background: #e0f2fe; color: #0284c7; border: 1px solid #bae6fd; border-radius: 5px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; flex: 1; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="View ${escapeHtml(labelWithDate)}">
                                👁️ ${escapeHtml(labelWithDate)}
                            </button>
                            <button type="button" onclick="deleteStaffDoctorReport('${item.id}', ${rIndex}, event)" class="btn-delete-report" style="padding: 4px 6px; font-size: 0.8rem; background: #ffe4e6; color: #be123c; border: 1px solid #fecdd3; border-radius: 5px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; flex-shrink: 0;" title="Delete report">
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

            const uploadBtnLabel = existingReports.length > 0 ? "➕ Add Report" : "📤 Upload Report";
            const staffReportActionHtml = `
                <div style="display: flex; flex-direction: column; gap: 6px; align-items: flex-start;">
                    <button type="button" class="btn-open-upload-modal" data-id="${item.id}" data-name="${escapeHtml(item.patient_name)}" style="padding: 6px 12px; font-size: 0.78rem; background: linear-gradient(135deg, #0f766e 0%, #0d9488 100%); color: white; border: none; border-radius: 6px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; white-space: nowrap;">
                        ${uploadBtnLabel}
                    </button>
                    ${reportDropdownHtml}
                </div>
            `;

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
                    <div style="max-width: 200px; font-size: 0.85rem; color: #334155; line-height: 1.4; word-break: break-word;">
                        ${escapeHtml(issueDisplay)}
                    </div>
                </td>
                <td>
                    ${staffReportActionHtml}
                </td>
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
    }

    document.addEventListener("click", function () {
        document.querySelectorAll(".reports-dropdown-menu").forEach(menu => menu.style.display = "none");
    });

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

    // Dynamic Time Slot loading for Phone Booking Modal
    const phoneDoctorSelect = document.getElementById("phoneDoctorSelect");
    const phoneDateInput = document.getElementById("phoneDate");
    const phoneTimeSelect = document.getElementById("phoneTime");

    async function updatePhoneBookingTimeSlots() {
        if (!phoneTimeSelect) return;
        const docId = phoneDoctorSelect ? phoneDoctorSelect.value : "";
        const selectedDate = phoneDateInput ? phoneDateInput.value : "";

        if (!docId || !selectedDate) {
            phoneTimeSelect.innerHTML = `<option value="">-- Select Doctor & Date First --</option>`;
            return;
        }

        phoneTimeSelect.innerHTML = `<option value="">⌛ Checking available slots...</option>`;

        try {
            const { data, error } = await supabaseClient
                .from("appointments")
                .select("appointment_time, status")
                .eq("doctor_id", docId)
                .eq("appointment_date", selectedDate)
                .neq("status", "Cancelled");

            const bookedTimes = new Set(
                (data || [])
                    .filter(app => app.appointment_time)
                    .map(app => normalizeTime(app.appointment_time))
            );

            const standardSlots = [
                "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM", "12:00 PM", "12:30 PM",
                "02:00 PM", "02:30 PM", "03:00 PM", "03:30 PM", "04:00 PM", "04:30 PM",
                "05:00 PM", "05:30 PM"
            ];

            let optionsHtml = `<option value="">-- Select Available Time Slot --</option>`;
            standardSlots.forEach(slot => {
                const norm = normalizeTime(slot);
                if (bookedTimes.has(norm)) {
                    optionsHtml += `<option value="${slot}" disabled style="color: #94a3b8; background: #f1f5f9;">🔴 ${slot} (Already Booked)</option>`;
                } else {
                    optionsHtml += `<option value="${slot}">🟢 ${slot} (Available)</option>`;
                }
            });

            phoneTimeSelect.innerHTML = optionsHtml;

        } catch (err) {
            console.error("Error fetching booked slots for phone booking:", err);
            phoneTimeSelect.innerHTML = `<option value="">-- Select Time Slot --</option>`;
        }
    }

    if (phoneDoctorSelect) phoneDoctorSelect.addEventListener("change", updatePhoneBookingTimeSlots);
    if (phoneDateInput) phoneDateInput.addEventListener("change", updatePhoneBookingTimeSlots);

    if (btnOpenPhoneBookingModal) {
        btnOpenPhoneBookingModal.addEventListener("click", () => {
            if (phoneBookingModal) phoneBookingModal.style.display = "flex";
            updatePhoneBookingTimeSlots();
        });
    }

    function closePhoneBookingModal() { if (phoneBookingModal) phoneBookingModal.style.display = "none"; }
    if (closePhoneBookingModalBtn) closePhoneBookingModalBtn.addEventListener("click", closePhoneBookingModal);
    if (cancelPhoneBookingModalBtn) cancelPhoneBookingModalBtn.addEventListener("click", closePhoneBookingModal);

    if (phoneBookingForm) {
        phoneBookingForm.addEventListener("submit", async function (e) {
            e.preventDefault();
            const doctor_id = document.getElementById("phoneDoctorSelect").value;
            const patient_name = document.getElementById("phonePatientName").value.trim();
            const age = document.getElementById("phoneAge").value;
            const gender = document.getElementById("phoneGender").value;
            const mobile = document.getElementById("phoneMobile").value.trim();
            const appointment_date = document.getElementById("phoneDate").value;
            const appointment_time = document.getElementById("phoneTime").value.trim();
            const issue = document.getElementById("phoneIssue").value.trim();

            if (!doctor_id || !patient_name || !mobile || !appointment_date || !appointment_time) {
                if (typeof showToast === "function") showToast("Please fill all required booking fields.", "error");
                return;
            }

            const submitBtn = document.getElementById("submitPhoneBookingBtn");
            if (submitBtn) submitBtn.disabled = true;

            try {
                // Strict Double Booking Check
                const { data: existingAppointments, error: checkErr } = await supabaseClient
                    .from("appointments")
                    .select("id, appointment_time, status")
                    .eq("doctor_id", doctor_id)
                    .eq("appointment_date", appointment_date)
                    .neq("status", "Cancelled");

                if (existingAppointments && existingAppointments.length > 0) {
                    const normSelectedTime = normalizeTime(appointment_time);
                    const isConflict = existingAppointments.some(app => 
                        normalizeTime(app.appointment_time) === normSelectedTime
                    );

                    if (isConflict) {
                        if (typeof showToast === "function") {
                            showToast(`⚠️ Time slot "${appointment_time}" is ALREADY BOOKED for this doctor on ${appointment_date}! Please select another slot.`, "error");
                        }
                        if (submitBtn) submitBtn.disabled = false;
                        await updatePhoneBookingTimeSlots();
                        return;
                    }
                }

                const { error } = await supabaseClient
                    .from("appointments")
                    .insert([{
                        doctor_id,
                        patient_name,
                        age: parseInt(age, 10),
                        gender,
                        mobile,
                        issue,
                        appointment_date,
                        appointment_time,
                        status: "Pending"
                    }]);

                if (error) throw error;

                if (typeof showToast === "function") showToast(`Phone booking created successfully for ${patient_name}!`, "success");
                phoneBookingForm.reset();
                closePhoneBookingModal();
                updatePhoneBookingTimeSlots();

            } catch (err) {
                console.error("Error creating phone booking:", err);
                if (typeof showToast === "function") showToast("Failed to create phone booking: " + err.message, "error");
            } finally {
                if (submitBtn) submitBtn.disabled = false;
            }
        });
    }

    // REPORT UPLOADING & DELETE
    window.deleteStaffDoctorReport = async function(appId, reportIndex, event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }

        try {
            const parsedId = isNaN(Number(appId)) ? appId : Number(appId);
            let targetItem = completedAppointments.find(a => String(a.id) === String(parsedId));

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
            fetchCompletedAppointments();

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
                let targetItem = completedAppointments.find(a => String(a.id) === String(parsedId));
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
                fetchCompletedAppointments();

            } catch (err) {
                console.error("Report upload error:", err);
                if (typeof showToast === "function") showToast("Error uploading report: " + err.message, "error");
            } finally {
                if (submitBtn) submitBtn.disabled = false;
                if (submitBtnText) submitBtnText.textContent = "📤 Save & Upload";
            }
        });
    }

    function setupRealtimeStaff() {
        if (!supabaseClient) return;
        supabaseClient.channel('staff-appointments-realtime').on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => fetchCompletedAppointments()).subscribe();
    }

    checkAuthSession();
    setupRealtimeStaff();
});
