// ==========================================
// DOCTOR DASHBOARD LOGIC (dashboard.js)
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
    const filterSearch = document.getElementById("filterSearch");

    const statTotal = document.getElementById("statTotal");
    const statPending = document.getElementById("statPending");
    const statConfirmed = document.getElementById("statConfirmed");
    const statCompleted = document.getElementById("statCompleted");

    let allAppointments = []; // In-memory store for instant client-side filtering

    // 1. Check if Supabase keys are configured
    if (!isSupabaseConfigured()) {
        configAlert.classList.add("active");
    }

    // Helper: Show Login Error
    function showLoginError(msg) {
        loginAlert.textContent = msg;
        loginAlert.classList.add("active");
    }

    function hideLoginError() {
        loginAlert.textContent = "";
        loginAlert.classList.remove("active");
    }

    function setLoginLoading(isLoading) {
        if (isLoading) {
            loginBtn.disabled = true;
            loginBtn.classList.add("loading");
            loginBtnText.textContent = "Authenticating...";
        } else {
            loginBtn.disabled = false;
            loginBtn.classList.remove("loading");
            loginBtnText.textContent = "Login";
        }
    }

    const doctorWelcomeTitle = document.getElementById("doctorWelcomeTitle");
    const doctorWelcomeSubtitle = document.getElementById("doctorWelcomeSubtitle");

    let currentDoctor = null;

    // Helper: Lookup Doctor Profile in 'doctors' table by Email
    async function loadDoctorProfile(email, createIfMissing = false) {
        if (!supabaseClient || !email) return null;

        try {
            const cleanEmail = email.trim().toLowerCase();
            
            // 1. Case-insensitive search using ilike
            let { data, error } = await supabaseClient
                .from("doctors")
                .select("*")
                .ilike("email", cleanEmail)
                .limit(1);

            if (data && data.length > 0) return data[0];

            // 2. Exact match fallback
            const retryRes = await supabaseClient
                .from("doctors")
                .select("*")
                .eq("email", email.trim())
                .limit(1);

            if (retryRes.data && retryRes.data.length > 0) return retryRes.data[0];

            // 3. Auto-create doctor profile if authenticated via Supabase Auth and allowed
            if (createIfMissing) {
                const rawName = cleanEmail.split("@")[0].replace(/[^a-zA-Z0-9]/g, " ");
                const formattedName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
                const { data: newDoc, error: insertErr } = await supabaseClient
                    .from("doctors")
                    .insert([{
                        name: "Dr. " + (formattedName || "Doctor"),
                        email: cleanEmail,
                        specialization: "General Dentistry"
                    }])
                    .select();

                if (newDoc && newDoc.length > 0) return newDoc[0];
            }

            return null;

        } catch (err) {
            console.error("Error loading doctor profile from Supabase:", err);
            return null;
        }
    }


    function updateDoctorHeader(doc) {
        if (!doc) {
            if (doctorWelcomeTitle) doctorWelcomeTitle.textContent = "Appointment Schedule Dashboard";
            if (doctorWelcomeSubtitle) doctorWelcomeSubtitle.textContent = "Manage and update patient appointments in real-time.";
            return;
        }
        let cleanName = String(doc.name || "").trim();
        if (!/^dr\.?\s+/i.test(cleanName)) {
            cleanName = "Dr. " + cleanName;
        }
        if (doctorWelcomeTitle) {
            doctorWelcomeTitle.innerHTML = `Welcome, <span class="doctor-name-teal">${escapeHtml(cleanName)}</span>`;
        }
        if (doctorWelcomeSubtitle) {
            const spec = doc.specialization ? ` | Specialization: ${doc.specialization}` : "";
            doctorWelcomeSubtitle.textContent = `Doctor Dashboard${spec}`;
        }
    }

    // 2. Auth State Observer & Initial Session Check (Direct URL Access Protection)
    async function checkAuthSession() {
        if (!isSupabaseConfigured() || !supabaseClient) {
            showLoginState();
            return;
        }

        try {
            const { data: { session }, error } = await supabaseClient.auth.getSession();
            if (session && session.user && session.user.email) {
                const docProfile = await loadDoctorProfile(session.user.email);
                if (docProfile) {
                    currentDoctor = docProfile;
                    sessionStorage.setItem("loggedInDoctor", JSON.stringify(currentDoctor));
                    updateDoctorHeader(currentDoctor);
                    showDashboardState();
                    fetchAppointments(currentDoctor.id);
                } else {
                    // Profile missing -> Logout silently & show clean login form
                    await supabaseClient.auth.signOut();
                    clearAllStoredData();
                    showLoginState();
                }
            } else {
                // No active session -> Show empty login form
                clearAllStoredData();
                showLoginState();
            }
        } catch (err) {
            console.error("Session check failed:", err);
            clearAllStoredData();
            showLoginState();
        }
    }

    // Helper: Clear all stored session & local data
    function clearAllStoredData() {
        sessionStorage.clear();
        localStorage.clear();
        sessionStorage.removeItem("loggedInDoctor");
        localStorage.removeItem("loggedInDoctor");
        currentDoctor = null;
        allAppointments = [];
    }

    // Listen for Auth Changes (Sign-in / Sign-out)
    if (supabaseClient) {
        supabaseClient.auth.onAuthStateChange(async (event, session) => {
            if (session && session.user && session.user.email) {
                const docProfile = await loadDoctorProfile(session.user.email);
                if (docProfile) {
                    currentDoctor = docProfile;
                    sessionStorage.setItem("loggedInDoctor", JSON.stringify(currentDoctor));
                    updateDoctorHeader(currentDoctor);
                    showDashboardState();
                    fetchAppointments(currentDoctor.id);
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

        // Manually clear email and password fields
        const emailInput = document.getElementById("doctorEmail");
        const passInput = document.getElementById("doctorPassword");
        if (emailInput) emailInput.value = "";
        if (passInput) passInput.value = "";
        if (loginForm) loginForm.reset();

        loginState.style.display = "block";
        dashboardState.style.display = "none";
        logoutBtn.style.display = "none";
    }

    function showDashboardState() {
        loginState.style.display = "none";
        dashboardState.style.display = "block";
        logoutBtn.style.display = "inline-flex";
    }

    // 3. Login Form Submit Handler (Strict Supabase Auth Verification)
    if (loginForm) {
        loginForm.addEventListener("submit", async function (e) {
            e.preventDefault();
            hideLoginError();

            // Clear any old session state on fresh login attempt
            clearAllStoredData();

            if (!isSupabaseConfigured() || !supabaseClient) {
                showLoginError("Supabase configuration missing in config.js!");
                return;
            }

            const email = document.getElementById("doctorEmail").value.trim();
            const password = document.getElementById("doctorPassword").value.trim();

            if (!email || !password) {
                showLoginError("Please enter both email and password.");
                return;
            }

            setLoginLoading(true);

            try {
                // STEP 1: Strict Supabase Auth Login (Verifies password with Supabase Auth)
                const { data, error } = await supabaseClient.auth.signInWithPassword({
                    email: email,
                    password: password
                });

                // If password or email is invalid, STOP immediately and show error
                if (error || !data || !data.user) {
                    console.error("Login Auth Error:", error);
                    throw new Error("Invalid email or password. Please try again.");
                }

                // STEP 2: Fetch Doctor Record from 'doctors' table (auto-create if missing for valid Auth user)
                const docProfile = await loadDoctorProfile(data.user.email || email, true);
                if (!docProfile) {
                    await supabaseClient.auth.signOut();
                    throw new Error("Doctor profile not found in clinic records. Please contact the administrator.");
                }

                // STEP 3: Authentication & Profile Verified -> Open Dashboard
                currentDoctor = docProfile;
                sessionStorage.setItem("loggedInDoctor", JSON.stringify(currentDoctor));
                updateDoctorHeader(currentDoctor);
                showDashboardState();
                fetchAppointments(currentDoctor.id);

                if (typeof showToast === "function") {
                    showToast(`Logged in successfully as ${currentDoctor.name}!`, "success");
                }

            } catch (err) {
                showLoginError(err.message || "Invalid email or password. Please try again.");
            } finally {
                setLoginLoading(false);
            }
        });
    }

    // 4. Logout Handler
    if (logoutBtn) {
        logoutBtn.addEventListener("click", async function () {
            // STEP 1: Execute Supabase Auth signOut()
            if (supabaseClient) {
                try {
                    await supabaseClient.auth.signOut();
                } catch (e) {
                    console.warn("SignOut error:", e);
                }
            }

            // STEP 2: Clear all stored session/local data and variables
            clearAllStoredData();
            hideLoginError();

            // STEP 3: Reset header text
            updateDoctorHeader(null);

            // STEP 4: Show empty login state (clears email and password fields)
            showLoginState();

            if (typeof showToast === "function") {
                showToast("Logged out successfully.", "info");
            }
        });
    }




    // 5. Fetch Appointments from Supabase Database (Doctor-wise filter)
    async function fetchAppointments(doctorId) {
        if (!supabaseClient) return;

        try {
            const targetDoctorId = doctorId || (currentDoctor ? currentDoctor.id : null);
            let query = supabaseClient.from("appointments").select("*").order("appointment_date", { ascending: true });

            // Filter strictly by doctor_id if doctor is logged in
            if (targetDoctorId) {
                query = query.eq("doctor_id", targetDoctorId);
            }

            const { data, error } = await query;

            if (error) {
                console.error("Error fetching appointments:", error);
                alert("Failed to fetch appointments: " + error.message);
                return;
            }

            allAppointments = data || [];
            updateStats(allAppointments);
            applyFilters();

        } catch (err) {
            console.error("Fetch Exception:", err);
        }
    }

    // Update Overview Stats Cards
    function updateStats(appointmentsList) {
        statTotal.textContent = appointmentsList.length;
        statPending.textContent = appointmentsList.filter(a => a.status === 'Pending').length;
        statConfirmed.textContent = appointmentsList.filter(a => a.status === 'Confirmed').length;
        statCompleted.textContent = appointmentsList.filter(a => a.status === 'Completed').length;
    }

    // 6. Combined Filter Logic (Date + Status + Patient Name Search)
    function applyFilters() {
        const dateVal = filterDate ? filterDate.value : "";
        const statusVal = filterStatus ? filterStatus.value : "";
        const searchVal = filterSearch ? filterSearch.value.toLowerCase().trim() : "";

        const filtered = allAppointments.filter(item => {
            // 1. Date Filter
            if (dateVal && item.appointment_date !== dateVal) {
                return false;
            }

            // 2. Status Filter
            if (statusVal && statusVal !== "All" && item.status !== statusVal) {
                return false;
            }

            // 3. Search Filter (patient_name case-insensitive partial match & mobile match)
            if (searchVal) {
                const name = (item.patient_name || "").toLowerCase();
                const mobile = (item.mobile || "").toLowerCase();
                if (!name.includes(searchVal) && !mobile.includes(searchVal)) {
                    return false;
                }
            }

            return true;
        });

        renderTable(filtered);
    }

    // Event Listeners for Filters
    if (filterDate) filterDate.addEventListener("change", applyFilters);
    if (filterStatus) filterStatus.addEventListener("change", applyFilters);
    if (filterSearch) filterSearch.addEventListener("input", applyFilters);
    if (clearDateBtn) {
        clearDateBtn.addEventListener("click", function () {
            if (filterDate) filterDate.value = "";
            applyFilters();
        });
    }

    // 7. Render Appointments Table
    function renderTable(list) {
        tableBody.innerHTML = "";

        if (!list || list.length === 0) {
            if (appointmentsTable) appointmentsTable.style.display = "none";
            emptyState.style.display = "block";
            if (emptyStateText) {
                if (allAppointments.length === 0) {
                    emptyStateText.textContent = "No appointments found.";
                } else {
                    emptyStateText.textContent = "No appointments found matching this filter.";
                }
            }
            return;
        }

        if (appointmentsTable) appointmentsTable.style.display = "table";
        emptyState.style.display = "none";

        list.forEach((item, index) => {
            const tr = document.createElement("tr");

            // Date formatting
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

            tr.innerHTML = `
                <td style="font-weight: 600; color: #64748b;">${index + 1}</td>
                <td><strong>${escapeHtml(item.patient_name)}</strong></td>
                <td>${item.age || '-'}</td>
                <td>${escapeHtml(genderDisplay)}</td>
                <td>${escapeHtml(item.mobile || '-')}</td>
                <td style="max-width:220px; word-wrap:break-word;">${escapeHtml(issueDisplay)}</td>
                <td>${formattedDate}</td>
                <td>${formattedTime}</td>
                <td>
                    <select class="status-select ${item.status || 'Pending'}" data-id="${item.id}">
                        <option value="Pending" ${item.status === 'Pending' ? 'selected' : ''}>Pending</option>
                        <option value="Confirmed" ${item.status === 'Confirmed' ? 'selected' : ''}>Confirmed</option>
                        <option value="Completed" ${item.status === 'Completed' ? 'selected' : ''}>Completed</option>
                        <option value="Cancelled" ${item.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
                    </select>
                </td>
            `;

            tableBody.appendChild(tr);
        });

        // Attach click listeners to toggle Reports Dropdowns
        document.querySelectorAll(".btn-toggle-reports-dropdown").forEach(btn => {
            btn.addEventListener("click", function (e) {
                e.stopPropagation();
                const targetId = this.getAttribute("data-target");
                const targetMenu = document.getElementById(targetId);
                
                // Hide all other open dropdown menus first
                document.querySelectorAll(".reports-dropdown-menu").forEach(menu => {
                    if (menu !== targetMenu) menu.style.display = "none";
                });

                if (targetMenu) {
                    targetMenu.style.display = (targetMenu.style.display === "none" || !targetMenu.style.display) ? "block" : "none";
                }
            });
        });

        // Close all dropdowns when clicking anywhere outside
        document.addEventListener("click", function () {
            document.querySelectorAll(".reports-dropdown-menu").forEach(menu => {
                menu.style.display = "none";
            });
        });

        // Attach event listener to status dropdowns
        document.querySelectorAll(".status-select").forEach(select => {
            select.addEventListener("change", handleStatusChange);
        });
    }

    // Global Report Delete Handler (Instant 1-Click Delete)
    window.deleteDoctorReport = async function(appId, reportIndex, event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }

        try {
            const parsedId = isNaN(Number(appId)) ? appId : Number(appId);
            let targetItem = allAppointments.find(a => String(a.id) === String(parsedId));

            // Fallback: If not in memory, query directly from Supabase DB
            if (!targetItem && supabaseClient) {
                const { data: dbRow } = await supabaseClient.from("appointments").select("*").eq("id", parsedId).maybeSingle();
                if (dbRow) targetItem = dbRow;
            }

            if (!targetItem) {
                console.error("Target appointment not found for ID:", appId);
                if (typeof showToast === "function") showToast("Appointment record not found.", "error");
                return;
            }

            let currentReports = (typeof getAppointmentReports === "function") 
                ? getAppointmentReports(targetItem) 
                : [];

            const rName = (reportIndex >= 0 && reportIndex < currentReports.length) 
                ? currentReports[reportIndex].name 
                : "Report";

            // Instant deletion without browser dialog blocking
            if (reportIndex >= 0 && reportIndex < currentReports.length) {
                currentReports.splice(reportIndex, 1);
            }

            const updatedReports = currentReports.length > 0 ? currentReports : null;
            const updatedDoctorReportUrl = currentReports.length > 0 
                ? currentReports.map(r => `${r.url}|||${r.name}`).join(", ") 
                : null;

            // Update database
            let { error: dbError } = await supabaseClient
                .from("appointments")
                .update({ 
                    doctor_reports: updatedReports,
                    doctor_report_url: updatedDoctorReportUrl 
                })
                .eq("id", parsedId);

            if (dbError && (dbError.message.includes("doctor_reports") || dbError.code === "PGRST204" || dbError.message.includes("schema cache"))) {
                console.warn("doctor_reports column not found, falling back to doctor_report_url update:", dbError.message);
                const fallbackRes = await supabaseClient
                    .from("appointments")
                    .update({ doctor_report_url: updatedDoctorReportUrl })
                    .eq("id", parsedId);
                dbError = fallbackRes.error;
            }

            if (dbError) throw new Error("Failed to remove report file: " + dbError.message);

            // Update in-memory target item immediately
            targetItem.doctor_reports = updatedReports;
            targetItem.doctor_report_url = updatedDoctorReportUrl;

            if (typeof showToast === "function") {
                showToast(`Report "${rName}" deleted successfully!`, "success");
            }

            // Close open dropdown menu
            document.querySelectorAll(".reports-dropdown-menu").forEach(menu => {
                menu.style.display = "none";
            });

            // Re-fetch & refresh table
            const doctorIdToRefresh = currentDoctor ? currentDoctor.id : null;
            fetchAppointments(doctorIdToRefresh);

        } catch (err) {
            console.error("Delete report error:", err);
            if (typeof showToast === "function") {
                showToast("Error removing report: " + err.message, "error");
            } else {
                alert("Error removing report: " + err.message);
            }
        }
    };

    // Modal logic for Uploading Doctor Report with Name/Label
    const uploadReportModal = document.getElementById("uploadReportModal");
    const closeUploadReportModal = document.getElementById("closeUploadReportModal");
    const cancelUploadReportBtn = document.getElementById("cancelUploadReportBtn");
    const uploadReportForm = document.getElementById("uploadReportForm");
    const reportTypeSelect = document.getElementById("reportTypeSelect");
    const reportNameInput = document.getElementById("reportNameInput");
    const reportFileInput = document.getElementById("reportFileInput");

    function openUploadReportModal(appId, patientName) {
        if (!uploadReportModal) return;
        const appIdInput = document.getElementById("uploadReportAppId");
        const patientNameElem = document.getElementById("uploadReportPatientName");
        const previewElem = document.getElementById("reportFileNamePreview");

        if (appIdInput) appIdInput.value = appId;
        if (patientNameElem) patientNameElem.textContent = `Patient: ${patientName}`;
        if (reportTypeSelect) reportTypeSelect.value = "";
        if (reportNameInput) reportNameInput.value = "";
        if (reportFileInput) reportFileInput.value = "";
        if (previewElem) {
            previewElem.style.display = "none";
            previewElem.innerHTML = "";
        }
        uploadReportModal.style.display = "flex";
    }

    function closeUploadReportModalFunc() {
        if (uploadReportModal) uploadReportModal.style.display = "none";
    }

    if (closeUploadReportModal) closeUploadReportModal.addEventListener("click", closeUploadReportModalFunc);
    if (cancelUploadReportBtn) cancelUploadReportBtn.addEventListener("click", closeUploadReportModalFunc);

    const reportFileDropZone = document.getElementById("reportFileDropZone");
    if (reportFileDropZone) {
        reportFileDropZone.addEventListener("click", function (e) {
            if (e.target !== reportFileInput && reportFileInput) {
                reportFileInput.click();
            }
        });
    }

    if (reportTypeSelect) {
        reportTypeSelect.addEventListener("change", function () {
            const val = this.value;
            if (val === "Other") {
                if (reportNameInput) {
                    reportNameInput.value = "";
                    reportNameInput.focus();
                }
            } else if (val) {
                if (reportNameInput) {
                    reportNameInput.value = val;
                }
            }
        });
    }

    if (reportFileInput) {
        reportFileInput.addEventListener("change", function () {
            const previewElem = document.getElementById("reportFileNamePreview");
            if (this.files && this.files[0]) {
                const file = this.files[0];
                if (previewElem) {
                    previewElem.style.display = "block";
                    previewElem.innerHTML = `📄 <strong>Selected File:</strong> ${escapeHtml(file.name)} <span style="font-weight: normal; color: #475569;">(${(file.size / (1024 * 1024)).toFixed(2)} MB)</span>`;
                }
            } else {
                if (previewElem) {
                    previewElem.style.display = "none";
                    previewElem.innerHTML = "";
                }
            }
        });
    }

    if (uploadReportForm) {
        uploadReportForm.addEventListener("submit", async function (e) {
            e.preventDefault();

            const appId = document.getElementById("uploadReportAppId").value;
            let reportName = reportNameInput ? reportNameInput.value.trim() : "";
            const files = reportFileInput ? reportFileInput.files : null;

            if (!files || !files[0]) {
                if (typeof showToast === "function") showToast("Please select a file to upload.", "error");
                return;
            }

            const file = files[0];
            const maxSizeBytes = 5 * 1024 * 1024;
            if (file.size > maxSizeBytes) {
                if (typeof showToast === "function") {
                    showToast(`File size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds maximum limit of 5MB.`, "error");
                } else {
                    alert(`File size exceeds 5MB limit. Please select a smaller file.`);
                }
                return;
            }

            const allowedTypes = ["image/jpeg", "image/png", "image/jpg", "application/pdf"];
            const fileExt = (file.name.split('.').pop() || "").toLowerCase();
            const isAllowed = allowedTypes.includes(file.type) || ["pdf", "jpg", "jpeg", "png"].includes(fileExt);

            if (!isAllowed) {
                if (typeof showToast === "function") {
                    showToast("Invalid file type. Only JPG, PNG images and PDF documents are allowed.", "error");
                } else {
                    alert("Invalid file type. Only JPG, PNG images and PDF documents are allowed.");
                }
                return;
            }

            if (!reportName) {
                reportName = "Report";
            }

            const submitBtn = document.getElementById("submitUploadReportBtn");
            const submitBtnText = document.getElementById("submitUploadReportBtnText");
            if (submitBtn) submitBtn.disabled = true;
            if (submitBtnText) submitBtnText.textContent = "Uploading...";

            try {
                const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
                const filePath = `doc_report_${Date.now()}_${cleanFileName}`;

                let mimeType = file.type;
                if (!mimeType || mimeType === "application/octet-stream") {
                    mimeType = fileExt === "pdf" ? "application/pdf" : "image/jpeg";
                }

                const { data: storageData, error: uploadError } = await supabaseClient
                    .storage
                    .from("patient-documents")
                    .upload(filePath, file, {
                        cacheControl: "3600",
                        contentType: mimeType,
                        upsert: false
                    });

                if (uploadError) {
                    console.error("Storage upload error:", uploadError);
                    let errStr = uploadError.message || "Storage upload failed";
                    throw new Error("Storage upload failed: " + errStr);
                }

                const { data: publicUrlData } = supabaseClient
                    .storage
                    .from("patient-documents")
                    .getPublicUrl(filePath);

                const publicUrl = publicUrlData ? publicUrlData.publicUrl : null;

                if (!publicUrl) {
                    throw new Error("Could not retrieve public URL for uploaded report.");
                }

                const parsedId = isNaN(Number(appId)) ? appId : Number(appId);
                const targetItem = allAppointments.find(a => String(a.id) === String(parsedId));
                
                let currentReports = (targetItem && typeof getAppointmentReports === "function") 
                    ? getAppointmentReports(targetItem) 
                    : [];

                currentReports.push({ name: reportName, url: publicUrl });

                const updatedDoctorReportUrl = currentReports.map(r => `${r.url}|||${r.name}`).join(", ");

                let { error: dbError } = await supabaseClient
                    .from("appointments")
                    .update({ 
                        doctor_reports: currentReports,
                        doctor_report_url: updatedDoctorReportUrl 
                    })
                    .eq("id", parsedId);

                if (dbError && (dbError.message.includes("doctor_reports") || dbError.code === "PGRST204" || dbError.message.includes("schema cache"))) {
                    console.warn("doctor_reports column missing in appointments table, falling back to doctor_report_url update:", dbError.message);
                    const fallbackRes = await supabaseClient
                        .from("appointments")
                        .update({ doctor_report_url: updatedDoctorReportUrl })
                        .eq("id", parsedId);
                    dbError = fallbackRes.error;
                }

                if (dbError) {
                    console.error("Database update error:", dbError);
                    throw new Error("Failed to save report to database: " + dbError.message);
                }

                if (typeof showToast === "function") {
                    showToast("Doctor Report uploaded successfully!", "success");
                }

                closeUploadReportModalFunc();

                const doctorIdToRefresh = currentDoctor ? currentDoctor.id : null;
                fetchAppointments(doctorIdToRefresh);

            } catch (err) {
                console.error("Doctor Report Upload Exception:", err);
                if (typeof showToast === "function") {
                    showToast("Error uploading report: " + err.message, "error");
                } else {
                    alert("Error uploading report: " + err.message);
                }
            } finally {
                if (submitBtn) submitBtn.disabled = false;
                if (submitBtnText) submitBtnText.textContent = "📤 Save & Upload";
            }
        });
    }

    // 8. Instant Status Update Handler (UPDATE query to Supabase)
    async function handleStatusChange(e) {
        const selectElem = e.target;
        const appointmentId = selectElem.getAttribute("data-id");
        const newStatus = selectElem.value;

        // Update class styling immediately
        selectElem.className = `status-select ${newStatus}`;

        try {
            const { data, error } = await supabaseClient
                .from("appointments")
                .update({ status: newStatus })
                .eq("id", appointmentId);

            if (error) {
                console.error("Status update error:", error);
                if (typeof showToast === "function") showToast("Failed to update status: " + error.message, "error");
                // Re-fetch to sync accurate data
                fetchAppointments();
                return;
            }

            if (typeof showToast === "function") {
                showToast(`Status updated to '${newStatus}'`, "success");
            }

            // Update in-memory item status, recalculate stats, and re-apply filters
            const targetItem = allAppointments.find(a => a.id == appointmentId);
            if (targetItem) {
                targetItem.status = newStatus;
                updateStats(allAppointments);
                applyFilters();
            }

        } catch (err) {
            console.error("Status Change Exception:", err);
            if (typeof showToast === "function") showToast("Status update error!", "error");
        }
    }

    // Helper: Escape HTML string to prevent XSS
    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // 9. Supabase Realtime Subscription Setup
    function setupRealtimeDashboard() {
        if (!supabaseClient) return;

        // Listen to live changes in 'doctors' table (email, name, profile updates)
        supabaseClient
            .channel('dashboard-doctors-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'doctors' }, async (payload) => {
                console.log("Real-time doctor change detected:", payload);
                if (currentDoctor && (payload.new?.id === currentDoctor.id || payload.old?.id === currentDoctor.id)) {
                    if (payload.eventType === 'DELETE') {
                        if (typeof showToast === "function") showToast("Your doctor profile was deleted from Supabase.", "warning");
                        if (logoutBtn) logoutBtn.click();
                        return;
                    }
                    const oldEmail = currentDoctor.email;
                    currentDoctor = payload.new;
                    updateDoctorHeader(currentDoctor);
                    
                    if (payload.new && payload.new.email !== oldEmail) {
                        if (typeof showToast === "function") {
                            showToast(`📧 Doctor Email updated to '${payload.new.email}' in real-time!`, "success", 4500);
                        }
                    } else {
                        if (typeof showToast === "function") {
                            showToast("Doctor profile updated in real-time!", "info");
                        }
                    }
                }
            })
            .subscribe();


        // Listen to live changes in 'appointments' table (new bookings, status changes, cancellations)
        supabaseClient
            .channel('dashboard-appointments-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, (payload) => {
                console.log("Real-time appointment change detected:", payload);
                if (currentDoctor) {
                    const docId = currentDoctor.id;
                    const newDocId = payload.new?.doctor_id;
                    const oldDocId = payload.old?.doctor_id;

                    if (!newDocId || newDocId === docId || oldDocId === docId) {
                        fetchAppointments(docId);
                    }
                }
            })
            .subscribe();
    }

    // ==========================================
    // DOCTOR AVAILABILITY & LEAVES TAB LOGIC
    // ==========================================

    const tabBtnAppointments = document.getElementById("tabBtnAppointments");
    const tabBtnAvailability = document.getElementById("tabBtnAvailability");
    const appointmentsTabSection = document.getElementById("appointmentsTabSection");
    const availabilityTabSection = document.getElementById("availabilityTabSection");

    const weeklyScheduleContainer = document.getElementById("weeklyScheduleContainer");
    const availabilityForm = document.getElementById("availabilityForm");
    const addLeaveForm = document.getElementById("addLeaveForm");
    const leavesListContainer = document.getElementById("leavesListContainer");
    const leaveDateInput = document.getElementById("leaveDate");
    const leaveReasonInput = document.getElementById("leaveReason");

    if (leaveDateInput) {
        const todayStr = new Date().toISOString().split("T")[0];
        leaveDateInput.setAttribute("min", todayStr);
    }

    function switchDashboardTab(tab) {
        if (tab === "availability") {
            if (tabBtnAppointments) {
                tabBtnAppointments.classList.remove("active");
                tabBtnAppointments.style.color = "var(--text-muted)";
                tabBtnAppointments.style.borderBottom = "none";
            }
            if (tabBtnAvailability) {
                tabBtnAvailability.classList.add("active");
                tabBtnAvailability.style.color = "var(--primary)";
                tabBtnAvailability.style.borderBottom = "3px solid var(--primary)";
            }
            if (appointmentsTabSection) appointmentsTabSection.style.display = "none";
            if (availabilityTabSection) availabilityTabSection.style.display = "block";

            loadDoctorAvailabilityAndLeaves();
        } else {
            if (tabBtnAvailability) {
                tabBtnAvailability.classList.remove("active");
                tabBtnAvailability.style.color = "var(--text-muted)";
                tabBtnAvailability.style.borderBottom = "none";
            }
            if (tabBtnAppointments) {
                tabBtnAppointments.classList.add("active");
                tabBtnAppointments.style.color = "var(--primary)";
                tabBtnAppointments.style.borderBottom = "3px solid var(--primary)";
            }
            if (availabilityTabSection) availabilityTabSection.style.display = "none";
            if (appointmentsTabSection) appointmentsTabSection.style.display = "block";
        }
    }

    window.switchDashboardTab = switchDashboardTab;

    if (tabBtnAppointments) {
        tabBtnAppointments.addEventListener("click", () => switchDashboardTab("appointments"));
    }
    if (tabBtnAvailability) {
        tabBtnAvailability.addEventListener("click", () => switchDashboardTab("availability"));
    }

    const daysOfWeekList = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

    async function loadDoctorAvailabilityAndLeaves() {
        if (!currentDoctor || !supabaseClient) return;

        try {
            const { data: availData, error: availError } = await supabaseClient
                .from("doctor_availability")
                .select("*")
                .eq("doctor_id", currentDoctor.id);

            if (availError) {
                console.warn("Could not fetch doctor availability:", availError);
            }

            const availMap = {};
            if (availData && availData.length > 0) {
                availData.forEach(item => {
                    availMap[item.day_of_week] = item;
                });
            }

            renderWeeklyScheduleRows(availMap);
            loadUpcomingLeaves();

        } catch (err) {
            console.error("Error loading availability/leaves:", err);
        }
    }

    function renderWeeklyScheduleRows(availMap) {
        if (!weeklyScheduleContainer) return;
        weeklyScheduleContainer.innerHTML = "";

        daysOfWeekList.forEach(day => {
            const existing = availMap[day] || {
                is_available: day !== "Sunday",
                start_time: "10:00:00",
                end_time: "18:00:00"
            };

            const isChecked = existing.is_available ? "checked" : "";
            const startTimeVal = String(existing.start_time || "10:00").substring(0, 5);
            const endTimeVal = String(existing.end_time || "18:00").substring(0, 5);

            const row = document.createElement("div");
            row.style.cssText = "display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; padding: 12px 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;";
            
            row.innerHTML = `
                <div style="display: flex; align-items: center; gap: 12px; min-width: 160px;">
                    <input type="checkbox" id="avail-check-${day}" class="day-avail-checkbox" data-day="${day}" ${isChecked} style="width: 18px; height: 18px; cursor: pointer; accent-color: var(--primary);">
                    <label for="avail-check-${day}" style="font-weight: 700; font-size: 0.95rem; color: var(--text-dark); cursor: pointer;">${day}</label>
                </div>

                <div id="time-inputs-container-${day}" style="display: flex; align-items: center; gap: 10px; opacity: ${existing.is_available ? '1' : '0.4'}; pointer-events: ${existing.is_available ? 'auto' : 'none'};">
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: 600;">Start:</span>
                        <input type="time" id="start-time-${day}" value="${startTimeVal}" style="padding: 6px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.9rem;">
                    </div>
                    <span style="color: var(--text-muted); font-weight: 700;">-</span>
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: 600;">End:</span>
                        <input type="time" id="end-time-${day}" value="${endTimeVal}" style="padding: 6px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.9rem;">
                    </div>
                </div>

                <span id="avail-status-badge-${day}" style="font-size: 0.8rem; font-weight: 700; padding: 4px 10px; border-radius: 20px; ${existing.is_available ? 'background: #dcfce7; color: #15803d;' : 'background: #ffe4e6; color: #be123c;'}">
                    ${existing.is_available ? 'Available' : 'Not Available'}
                </span>
            `;

            weeklyScheduleContainer.appendChild(row);

            const checkbox = row.querySelector(`#avail-check-${day}`);
            const timeContainer = row.querySelector(`#time-inputs-container-${day}`);
            const statusBadge = row.querySelector(`#avail-status-badge-${day}`);

            checkbox.addEventListener("change", function () {
                if (this.checked) {
                    timeContainer.style.opacity = "1";
                    timeContainer.style.pointerEvents = "auto";
                    statusBadge.style.background = "#dcfce7";
                    statusBadge.style.color = "#15803d";
                    statusBadge.textContent = "Available";
                } else {
                    timeContainer.style.opacity = "0.4";
                    timeContainer.style.pointerEvents = "none";
                    statusBadge.style.background = "#ffe4e6";
                    statusBadge.style.color = "#be123c";
                    statusBadge.textContent = "Not Available";
                }
            });
        });
    }

    if (availabilityForm) {
        availabilityForm.addEventListener("submit", async function (e) {
            e.preventDefault();
            if (!currentDoctor || !supabaseClient) return;

            const saveBtn = document.getElementById("saveAvailabilityBtn");
            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.textContent = "Saving...";
            }

            try {
                const upsertRows = daysOfWeekList.map(day => {
                    const isAvailable = document.getElementById(`avail-check-${day}`)?.checked || false;
                    const startTime = document.getElementById(`start-time-${day}`)?.value || "10:00";
                    const endTime = document.getElementById(`end-time-${day}`)?.value || "18:00";

                    return {
                        doctor_id: currentDoctor.id,
                        day_of_week: day,
                        is_available: isAvailable,
                        start_time: startTime + (startTime.length === 5 ? ":00" : ""),
                        end_time: endTime + (endTime.length === 5 ? ":00" : "")
                    };
                });

                const { error } = await supabaseClient
                    .from("doctor_availability")
                    .upsert(upsertRows, { onConflict: "doctor_id,day_of_week" });

                if (error) {
                    console.error("Error saving availability:", error);
                    alert("Failed to save availability: " + error.message);
                } else {
                    if (typeof showToast === "function") {
                        showToast("✅ Weekly working schedule saved successfully!", "success");
                    }
                }

            } catch (err) {
                console.error("Save availability exception:", err);
            } finally {
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.textContent = "💾 Save Availability";
                }
            }
        });
    }

    async function loadUpcomingLeaves() {
        if (!currentDoctor || !supabaseClient || !leavesListContainer) return;

        try {
            const todayStr = new Date().toISOString().split("T")[0];
            const { data: leaves, error } = await supabaseClient
                .from("doctor_leaves")
                .select("*")
                .eq("doctor_id", currentDoctor.id)
                .gte("leave_date", todayStr)
                .order("leave_date", { ascending: true });

            if (error) {
                console.warn("Could not fetch doctor leaves:", error);
                leavesListContainer.innerHTML = `<p style="color: #e11d48;">Error loading leaves.</p>`;
                return;
            }

            if (!leaves || leaves.length === 0) {
                leavesListContainer.innerHTML = `<p style="color: var(--text-muted); font-size: 0.9rem;">No upcoming marked leaves.</p>`;
                return;
            }

            let html = `<div style="display: flex; flex-direction: column; gap: 8px;">`;
            leaves.forEach(item => {
                const formattedLeaveDate = item.leave_date;
                const reasonText = item.reason ? ` (${escapeHtml(item.reason)})` : "";

                html += `
                    <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: #fff1f2; border: 1px solid #fecdd3; border-radius: 8px;">
                        <div>
                            <strong style="color: #be123c; font-size: 0.95rem;">🗓️ ${formattedLeaveDate}</strong>
                            <span style="color: #881337; font-size: 0.88rem; margin-left: 6px;">${reasonText}</span>
                        </div>
                        <button type="button" class="btn-delete-leave" data-leave-id="${item.id}" style="padding: 4px 10px; font-size: 0.78rem; background: #ffe4e6; color: #be123c; border: 1px solid #fca5a5; border-radius: 6px; font-weight: 700; cursor: pointer;">
                            🗑️ Delete
                        </button>
                    </div>
                `;
            });
            html += `</div>`;

            leavesListContainer.innerHTML = html;

            leavesListContainer.querySelectorAll(".btn-delete-leave").forEach(btn => {
                btn.addEventListener("click", async function () {
                    const leaveId = this.getAttribute("data-leave-id");
                    if (confirm("Are you sure you want to delete this leave record?")) {
                        await deleteLeaveRecord(leaveId);
                    }
                });
            });

        } catch (err) {
            console.error("Load leaves exception:", err);
        }
    }

    // Emergency Leave Warning Modal Setup
    const emergencyLeaveModal = document.getElementById("emergencyLeaveModal");
    const emergencyLeaveModalBody = document.getElementById("emergencyLeaveModalBody");
    const cancelLeaveBtn = document.getElementById("cancelLeaveBtn");
    const confirmEmergencyLeaveBtn = document.getElementById("confirmEmergencyLeaveBtn");

    let pendingLeaveData = null; // Holds { dateVal, reasonVal } when modal is open

    function closeEmergencyLeaveModal() {
        if (emergencyLeaveModal) emergencyLeaveModal.style.display = "none";
        pendingLeaveData = null;
    }

    if (cancelLeaveBtn) {
        cancelLeaveBtn.addEventListener("click", function () {
            closeEmergencyLeaveModal();
        });
    }

    if (emergencyLeaveModal) {
        emergencyLeaveModal.addEventListener("click", function (e) {
            if (e.target === emergencyLeaveModal) {
                closeEmergencyLeaveModal();
            }
        });
    }

    if (confirmEmergencyLeaveBtn) {
        confirmEmergencyLeaveBtn.addEventListener("click", async function () {
            if (!pendingLeaveData || !currentDoctor || !supabaseClient) return;

            const { dateVal, reasonVal } = pendingLeaveData;
            confirmEmergencyLeaveBtn.disabled = true;
            confirmEmergencyLeaveBtn.textContent = "Processing...";

            try {
                // 1. Save Leave to 'doctor_leaves' table
                const { error: leaveErr } = await supabaseClient
                    .from("doctor_leaves")
                    .upsert([{
                        doctor_id: currentDoctor.id,
                        leave_date: dateVal,
                        reason: reasonVal
                    }], { onConflict: "doctor_id,leave_date" });

                if (leaveErr) {
                    console.error("Error saving emergency leave:", leaveErr);
                    alert("Failed to mark leave: " + leaveErr.message);
                    return;
                }

                // 2. Cancel all affected Pending/Confirmed appointments for this doctor on this leave date
                const { error: cancelErr } = await supabaseClient
                    .from("appointments")
                    .update({
                        status: "Cancelled",
                        cancellation_reason: "Doctor unavailable due to emergency leave"
                    })
                    .eq("doctor_id", currentDoctor.id)
                    .eq("appointment_date", dateVal)
                    .in("status", ["Pending", "Confirmed"]);

                if (cancelErr) {
                    console.error("Error cancelling affected appointments:", cancelErr);
                    alert("Leave marked, but failed to cancel affected appointments: " + cancelErr.message);
                } else {
                    if (leaveReasonInput) leaveReasonInput.value = "";
                    if (leaveDateInput) leaveDateInput.value = "";

                    if (typeof showToast === "function") {
                        showToast(`⚠️ Emergency leave marked & affected appointments cancelled for ${dateVal}!`, "warning");
                    }

                    loadUpcomingLeaves();
                    fetchAppointments(currentDoctor.id);
                }
            } catch (err) {
                console.error("Confirm emergency leave exception:", err);
            } finally {
                confirmEmergencyLeaveBtn.disabled = false;
                confirmEmergencyLeaveBtn.textContent = "Yes, Mark Leave & Cancel These Appointments";
                closeEmergencyLeaveModal();
            }
        });
    }

    if (addLeaveForm) {
        addLeaveForm.addEventListener("submit", async function (e) {
            e.preventDefault();
            if (!currentDoctor || !supabaseClient) return;

            const dateVal = leaveDateInput ? leaveDateInput.value : "";
            const reasonVal = leaveReasonInput ? leaveReasonInput.value.trim() : "";

            if (!dateVal) return;

            const addBtn = document.getElementById("addLeaveBtn");
            if (addBtn) addBtn.disabled = true;

            try {
                // Step 1: Check 'appointments' table for active bookings on this date for this doctor
                const { data: bookedApps, error: checkErr } = await supabaseClient
                    .from("appointments")
                    .select("id, patient_name, appointment_time, status")
                    .eq("doctor_id", currentDoctor.id)
                    .eq("appointment_date", dateVal)
                    .in("status", ["Pending", "Confirmed"])
                    .order("appointment_time", { ascending: true });

                if (checkErr) {
                    console.error("Error checking appointments for leave date:", checkErr);
                }

                // If 1 or more appointments exist, show Warning Modal before saving leave!
                if (bookedApps && bookedApps.length > 0) {
                    pendingLeaveData = { dateVal, reasonVal };

                    let appListHtml = `
                        <p style="font-weight: 700; color: #be123c; margin-bottom: 12px; font-size: 0.95rem;">
                            ⚠️ <strong>${bookedApps.length}</strong> appointment(s) already booked on this date (${dateVal}):
                        </p>
                        <ul style="padding-left: 20px; margin-bottom: 16px; color: #334155; font-size: 0.9rem;">
                    `;

                    bookedApps.forEach(app => {
                        const timeFormatted = typeof formatTime12Hour === "function" ? formatTime12Hour(app.appointment_time) : app.appointment_time;
                        appListHtml += `<li style="margin-bottom: 6px;"><strong>${escapeHtml(app.patient_name)}</strong> at <strong>${escapeHtml(timeFormatted)}</strong> (${escapeHtml(app.status)})</li>`;
                    });

                    appListHtml += `
                        </ul>
                        <p style="background: #fff1f2; padding: 12px 14px; border-radius: 8px; border: 1px solid #fecdd3; color: #9f1239; font-weight: 600; font-size: 0.88rem; margin: 0;">
                            Are you sure you want to mark this leave? If yes, all these appointments will be marked as <strong>'Cancelled'</strong>.
                        </p>
                    `;

                    if (emergencyLeaveModalBody) emergencyLeaveModalBody.innerHTML = appListHtml;
                    if (emergencyLeaveModal) emergencyLeaveModal.style.display = "flex";

                    return;
                }

                // Step 2: If 0 appointments exist, save leave normally with NO extra popup
                const { error } = await supabaseClient
                    .from("doctor_leaves")
                    .upsert([{
                        doctor_id: currentDoctor.id,
                        leave_date: dateVal,
                        reason: reasonVal
                    }], { onConflict: "doctor_id,leave_date" });

                if (error) {
                    console.error("Error adding leave:", error);
                    alert("Failed to mark leave: " + error.message);
                } else {
                    if (leaveReasonInput) leaveReasonInput.value = "";
                    if (leaveDateInput) leaveDateInput.value = "";
                    if (typeof showToast === "function") {
                        showToast(`🏖️ Leave marked for ${dateVal}!`, "success");
                    }
                    loadUpcomingLeaves();
                }
            } catch (err) {
                console.error("Add leave exception:", err);
            } finally {
                if (addBtn) addBtn.disabled = false;
            }
        });
    }

    async function deleteLeaveRecord(leaveId) {
        if (!leaveId || !supabaseClient) return;

        try {
            const { error } = await supabaseClient
                .from("doctor_leaves")
                .delete()
                .eq("id", leaveId);

            if (error) {
                console.error("Error deleting leave:", error);
                alert("Failed to delete leave: " + error.message);
            } else {
                if (typeof showToast === "function") {
                    showToast("Leave record deleted.", "info");
                }
                loadUpcomingLeaves();
            }
        } catch (err) {
            console.error("Delete leave exception:", err);
        }
    }

    // Initial session check & setup Realtime listeners
    checkAuthSession();
    setupRealtimeDashboard();
});

